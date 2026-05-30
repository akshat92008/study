import { NextResponse } from 'next/server';
import { EventWorkerService } from '@/lib/events/worker';
import { logger } from '@/lib/utils/logger';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60; // Max execution time 60 seconds (adjust based on Vercel plan)

export async function POST(req: Request) {
  try {
    // Optionally: Authenticate via a secret header to ensure only Vercel/cron/internal can hit this
    const authError = validateCronRequest(req as any);
    if (authError) return authError;

    const start = Date.now();
    const processedCount = await EventWorkerService.processBatch(50, 5); // 50 items, 5 min lease

    return NextResponse.json({
      success: true,
      processed_count: processedCount,
      duration_ms: Date.now() - start
    });
  } catch (error) {
    logger.error('Error in worker route', { error });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const authError = validateCronRequest(req as any);
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
    logger.error('Error in worker health route', { error });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
