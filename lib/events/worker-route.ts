import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { logger } from '@/lib/utils/logger';
import { EventWorkerService } from './worker';

export async function processEventWorkerRoute(req: NextRequest | Request) {
  const authError = validateCronRequest(req as NextRequest);
  if (authError) return authError;

  try {
    const start = Date.now();
    const processedCount = await EventWorkerService.processBatch(50, 5);

    return NextResponse.json({
      success: true,
      processed_count: processedCount,
      duration_ms: Date.now() - start,
    });
  } catch (error: any) {
    logger.error('process-events worker route failed', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function eventWorkerHealthRoute(req: NextRequest | Request) {
  const authError = validateCronRequest(req as NextRequest);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();
    const [pending, processing, dlq] = await Promise.all([
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    ]);

    return NextResponse.json({
      ok: !pending.error && !processing.error && !dlq.error,
      worker: 'event_worker',
      queue: {
        pending: pending.count || 0,
        processing: processing.count || 0,
        unresolvedDlq: dlq.count || 0,
      },
      errors: [pending.error?.message, processing.error?.message, dlq.error?.message].filter(Boolean),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('event worker health route failed', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
