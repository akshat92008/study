export const maxDuration = 60;
import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { materialContentHash } from '@/lib/rag/ingest';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventWorkerService } from '@/lib/events/worker';
import { logger } from '@/lib/utils/logger';
import { featureFlags } from '@/lib/feature-registry';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required.', requestId });
    }

    const { url, goalId, title } = await req.json();
    if (!url) {
      return apiErrorResponse('invalid_url', { status: 400, message: 'URL is required.', requestId });
    }

    // Fetch URL
    const res = await fetch(url);
    if (!res.ok) {
      return apiErrorResponse('fetch_failed', { status: 400, message: `Failed to fetch URL: ${res.statusText}`, requestId });
    }

    const html = await res.text();
    // simple html to text
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const buffer = Buffer.from(textContent, 'utf-8');
    const contentHash = materialContentHash(buffer);

    if (goalId) {
      await ensureGoalForUser(supabase, user.id, goalId);
    }

    const originalFilename = url;
    const finalTitle = title || url;
    const mimeType = 'text/plain';
    const storagePath = `${user.id}/${Date.now()}-${contentHash.slice(0, 12)}-url.txt`;

    const upload = await supabase.storage
      .from('study-materials')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    if (upload.error) throw upload.error;

    const initialStatus = featureFlags.ragIngestion() ? 'queued' : 'uploaded';

    const { data: material, error: insertError } = await supabase
      .from('study_materials')
      .insert({
        user_id: user.id,
        title: finalTitle,
        original_filename: originalFilename,
        mime_type: mimeType,
        storage_path: storagePath,
        source_type: 'article',
        language: 'en',
        status: initialStatus,
        queued_at: featureFlags.ragIngestion() ? new Date().toISOString() : null,
        retryable: false,
        content_hash: contentHash,
        goal_id: goalId,
      })
      .select('id, title, status')
      .single();

    if (insertError) throw insertError;

    if (featureFlags.ragIngestion()) {
      const adminClient = await import('@/lib/supabase/admin').then(m => m.createAdminClient());
      await adminClient
        .from('rag_ingestion_jobs')
        .upsert({
          user_id: user.id,
          material_id: material.id,
          status: 'queued',
          idempotency_key: `rag_ingestion:${user.id}:${material.id}`,
          metadata: { mimeType },
        });
    }

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'MATERIAL_UPLOADED',
      data: { materialId: material.id, goalId },
      metadata: { source: 'materials_upload', goalId },
      idempotency_key: `material_uploaded:${material.id}`,
    });

    after(async () => {
      try {
        await EventWorkerService.processBatch(25, 5, 50_000, Date.now());
      } catch (workerError) {
        logger.error('Instant worker trigger failed', { error: workerError });
      }
    });

    return NextResponse.json({
      material,
      chunksProcessed: 0,
      duplicate: false,
    }, { status: 202, headers: { 'x-request-id': requestId } });

  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'materials_ingest_url_unhandled', 'Unable to ingest URL.');
  }
}
