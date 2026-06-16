import { after, NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestId } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventWorkerService } from '@/lib/events/worker';
import { featureFlags } from '@/lib/feature-registry';
import { logger } from '@/lib/utils/logger';
import { nextRetryCount, reprocessJobKey, shouldQueueReprocess } from '@/lib/materials/reprocess-state';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function errorResponse(input: {
  status: number;
  errorCode: string;
  message: string;
  requestId: string;
  retryable: boolean;
}) {
  return NextResponse.json({ ok: false, ...input }, {
    status: input.status,
    headers: { 'x-request-id': input.requestId },
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse({ status: 401, errorCode: 'unauthorized', message: 'Authentication is required.', requestId, retryable: false });
    }
    if (!featureFlags.ragIngestion()) {
      return errorResponse({ status: 503, errorCode: 'rag_unavailable', message: 'Source processing is currently disabled.', requestId, retryable: true });
    }

    const { id: materialId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true || new URL(req.url).searchParams.get('force') === 'true';
    const { data: material, error } = await supabase
      .from('study_materials')
      .select('id, user_id, mime_type, storage_path, status, retry_count')
      .eq('id', materialId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!material) {
      return errorResponse({ status: 404, errorCode: 'not_found', message: 'Study material was not found.', requestId, retryable: false });
    }
    if (!material.storage_path) {
      return errorResponse({ status: 422, errorCode: 'missing_storage_file', message: 'The original source file is unavailable. Upload it again.', requestId, retryable: false });
    }

    if (!shouldQueueReprocess(material.status, force)) {
      return NextResponse.json({
        ok: true,
        materialId: material.id,
        status: 'processing',
        jobId: null,
        requestId,
        duplicate: true,
      }, { status: 200, headers: { 'x-request-id': requestId } });
    }

    const INLINE_REPROCESS_MAX_BYTES = 50 * 1024;
    let inlineResult: any = null;
    let shouldIngestInline = false;

    if (featureFlags.ragIngestion()) {
      const { data: fileBlob, error: downloadError } = await supabase.storage.from('study-materials').download(material.storage_path);
      if (!downloadError && fileBlob && fileBlob.size <= INLINE_REPROCESS_MAX_BYTES) {
        shouldIngestInline = true;
        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const { ingestStudyMaterial } = await import('@/lib/rag/ingest');
        inlineResult = await ingestStudyMaterial({
          materialId: material.id,
          userId: user.id,
          buffer,
          mimeType: material.mime_type,
        });
      }
    }

    const retryCount = nextRetryCount(material.status, Number(material.retry_count ?? 0));
    const idempotencyKey = reprocessJobKey(user.id, material.id);
    let job: any = null;

    if (!shouldIngestInline) {
      const { data: jobData, error: jobError } = await supabase
        .from('rag_ingestion_jobs')
        .upsert({
          user_id: user.id,
          material_id: material.id,
          status: 'queued',
          idempotency_key: idempotencyKey,
          attempt_count: retryCount,
          error: null,
          error_code: null,
          started_at: null,
          completed_at: null,
          metadata: { mimeType: material.mime_type, requestedBy: 'user_reprocess', requestId },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,material_id,idempotency_key' })
        .select('id')
        .single();
      if (jobError || !jobData) throw jobError ?? new Error('Unable to create source processing job.');
      job = jobData;
    }

    const finalStatus = shouldIngestInline ? (inlineResult?.status === 'failed' ? 'failed' : 'ready') : 'queued';
    const { error: updateError } = await supabase
      .from('study_materials')
      .update({
        status: finalStatus,
        queued_at: new Date().toISOString(),
        retry_count: retryCount,
        retryable: false,
        error_message: null,
        last_error: null,
        last_error_code: null,
        next_retry_at: null,
        processing_started_at: null,
        processing_finished_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', material.id)
      .eq('user_id', user.id);
    if (updateError) throw updateError;

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'MATERIAL_INGESTION_REQUESTED',
      data: { materialId: material.id, force },
      metadata: { source: 'materials_reprocess', requestId },
      idempotency_key: `material_reprocess_requested:${material.id}:${requestId}`,
    });

    logger.info('material_reprocess_requested', {
      requestId,
      userId: user.id,
      materialId: material.id,
      jobId: job?.id,
      retryCount,
    });

    after(async () => {
      if (!shouldIngestInline) {
        await EventWorkerService.processBatch(25, 5, 50_000, Date.now()).catch((workerError) => {
          logger.error('material_reprocess_worker_trigger_failed', workerError, { requestId, materialId: material.id });
        });
      }
    });

    const result = inlineResult ?? { status: 'queued' };

    return NextResponse.json({
      ok: true,
      materialId: material.id,
      status: result.status,
      jobId: job?.id,
      requestId,
    }, { status: result.status === 'ready' ? 200 : 202, headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('material_reprocess_failed', error, { requestId });
    return errorResponse({
      status: 500,
      errorCode: 'material_reprocess_failed',
      message: error instanceof Error ? error.message : 'Unable to reprocess study material.',
      requestId,
      retryable: true,
    });
  }
}
