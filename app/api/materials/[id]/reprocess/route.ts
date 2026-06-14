import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventWorkerService } from '@/lib/events/worker';
import { createAdminClient } from '@/lib/supabase/admin';
import { featureFlags } from '@/lib/config/flags';
import { ingestStudyMaterial } from '@/lib/rag/ingest';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const INLINE_REPROCESS_MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, errorCode: 'unauthorized', message: 'Authentication is required.', requestId, retryable: false }, { status: 401 });
    }

    const params = await context.params;
    const { data: material, error } = await supabase
      .from('study_materials')
      .select('id, user_id, mime_type, storage_path')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) throw error;
    
    if (!material?.storage_path) {
      return NextResponse.json({ ok: false, errorCode: 'not_found', message: 'Study material file was not found.', requestId, retryable: false }, { status: 404 });
    }

    if (featureFlags.ragIngestion()) {
      const admin = createAdminClient();
      const download = await admin.storage
        .from('study-materials')
        .download(material.storage_path);

      if (download.error || !download.data) {
        return NextResponse.json({ ok: false, errorCode: 'download_failed', message: 'The stored source file could not be downloaded for indexing.', requestId, retryable: true }, { status: 404 });
      }

      const arrayBuffer = await download.data.arrayBuffer();
      if (arrayBuffer.byteLength <= INLINE_REPROCESS_MAX_BYTES) {
        await supabase
          .from('study_materials')
          .update({
            status: 'processing',
            retryable: false,
            error_message: null,
            last_error: null,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', material.id)
          .eq('user_id', user.id);

        await EventDispatcher.publish({
          user_id: user.id,
          type: 'MATERIAL_INGESTION_REQUESTED',
          data: { materialId: material.id },
          metadata: { source: 'materials_reprocess_inline' },
          idempotency_key: `material_reprocess_requested:${material.id}`,
        });

        const result = await ingestStudyMaterial({
          materialId: material.id,
          userId: user.id,
          buffer: Buffer.from(arrayBuffer),
          mimeType: material.mime_type,
        });

        return NextResponse.json(
          { ok: true, materialId: material.id, status: result.status, jobId: `inline-${requestId}`, requestId, chunksProcessed: result.chunks },
          { status: result.status === 'ready' ? 200 : 202, headers: { 'x-request-id': requestId } }
        );
      }
    }

    const idempotencyKey = `rag_reprocess:${user.id}:${material.id}`;
    const { error: jobError } = await supabase
      .from('rag_ingestion_jobs')
      .upsert({
        user_id: user.id,
        material_id: material.id,
        status: 'queued',
        idempotency_key: idempotencyKey,
        metadata: {
          mimeType: material.mime_type,
          requestedBy: 'user_reprocess',
        },
      }, { onConflict: 'user_id,material_id,idempotency_key' })
      .select('id')
      .single();
    
    if (jobError) throw jobError;
    const jobId = (jobError as any)?.id || `job-${requestId}`; // Fallback if insert didn't return id

    await supabase
      .from('study_materials')
      .update({ 
        status: 'queued', 
        queued_at: new Date().toISOString(),
        retryable: false, 
        error_message: null, 
        last_error: null,
        next_retry_at: null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', material.id)
      .eq('user_id', user.id);

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'MATERIAL_INGESTION_REQUESTED',
      data: { materialId: material.id },
      metadata: { source: 'materials_reprocess' },
      idempotency_key: `material_reprocess_requested:${material.id}`,
    });

    const { after } = await import('next/server');
    after(async () => {
      try {
        await EventWorkerService.processBatch(25, 5, 50_000, Date.now());
      } catch (workerError) {
        console.error('Instant worker trigger failed', { error: workerError });
      }
    });

    return NextResponse.json(
      { ok: true, materialId: material.id, status: 'queued', jobId, requestId },
      { status: 202, headers: { 'x-request-id': requestId } }
    );
  } catch (error) {
    console.error('Reprocess route error:', error);
    return NextResponse.json({ ok: false, errorCode: 'internal_error', message: 'Unable to reprocess study material.', requestId, retryable: true }, { status: 500 });
  }
}
