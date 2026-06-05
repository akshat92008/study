import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const QUEUED_TIMEOUT_MINUTES = 5;
const PROCESSING_TIMEOUT_MINUTES = 10;
const MAX_RETRIES = 3;

export async function GET(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) {
    return authError;
  }

  const supabase = createAdminClient();

  try {
    const now = new Date();
    
    // Find stalled non-terminal jobs
    const { data: stalledMaterials, error: fetchError } = await supabase
      .from('study_materials')
      .select('id, user_id, status, queued_at, processing_started_at, parsed_at, embedding_started_at, retry_count')
      .in('status', ['queued', 'processing', 'parsed', 'embedding']);
      
    if (fetchError) throw fetchError;

    let repaired = 0;
    let failed = 0;

    for (const mat of stalledMaterials || []) {
      const isStalled = checkStalled(mat, now);
      
      if (isStalled) {
        if (mat.retry_count >= MAX_RETRIES) {
          // Permanently fail
          await supabase
            .from('study_materials')
            .update({ 
              status: 'failed', 
              failed_at: now.toISOString(),
              last_error: 'Max retries exceeded due to repeated stalling.',
              updated_at: now.toISOString()
            })
            .eq('id', mat.id);
          failed++;
        } else {
          // Re-queue
          await supabase
            .from('study_materials')
            .update({ 
              status: 'queued', 
              queued_at: now.toISOString(),
              retry_count: mat.retry_count + 1,
              updated_at: now.toISOString()
            })
            .eq('id', mat.id);
          
          // Attempt to invoke the ingestion worker asynchronously, ignoring the result
          invokeIngestionWorker(mat.id, mat.user_id, req.headers.get('host') || 'localhost:3000');
          repaired++;
        }
      }
    }

    // Also look for explicitly failed materials that are due for a retry
    const { data: retryableMaterials, error: retryError } = await supabase
      .from('study_materials')
      .select('id, user_id, retry_count')
      .eq('status', 'failed')
      .lte('next_retry_at', now.toISOString());

    if (!retryError && retryableMaterials) {
      for (const mat of retryableMaterials) {
        if (mat.retry_count < MAX_RETRIES) {
          await supabase
            .from('study_materials')
            .update({ 
              status: 'queued', 
              queued_at: now.toISOString(),
              retry_count: mat.retry_count + 1,
              next_retry_at: null,
              updated_at: now.toISOString()
            })
            .eq('id', mat.id);
          invokeIngestionWorker(mat.id, mat.user_id, req.headers.get('host') || 'localhost:3000');
          repaired++;
        }
      }
    }

    return NextResponse.json({
      status: 'ok',
      repaired,
      failed,
      timestamp: now.toISOString()
    });
  } catch (err: any) {
    logger.error('Stalled queue anomaly detection failed', err);
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}

function checkStalled(mat: any, now: Date): boolean {
  if (mat.status === 'queued' && mat.queued_at) {
    const elapsed = (now.getTime() - new Date(mat.queued_at).getTime()) / 60000;
    if (elapsed > QUEUED_TIMEOUT_MINUTES) return true;
  } else if (['processing', 'parsed', 'embedding'].includes(mat.status)) {
    // Start time is the most recent timestamp available for the current stage
    const startedAt = mat.embedding_started_at || mat.parsed_at || mat.processing_started_at;
    if (startedAt) {
      const elapsed = (now.getTime() - new Date(startedAt).getTime()) / 60000;
      if (elapsed > PROCESSING_TIMEOUT_MINUTES) return true;
    } else {
      // If no timestamp exists but it's in a processing state, it's anomalous
      return true;
    }
  }
  return false;
}

function invokeIngestionWorker(materialId: string, userId: string, host: string) {
  // Fire and forget
  const protocol = host.includes('localhost') ? 'http' : 'https';
  fetch(`${protocol}://${host}/api/internal/rag/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
    },
    body: JSON.stringify({ materialId, userId })
  }).catch(err => {
    logger.warn('Failed to invoke ingestion worker for retry', err);
  });
}
