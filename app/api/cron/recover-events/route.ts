// app/api/cron/recover-events/route.ts
// Run every 5 minutes via Vercel Cron.
// Recovers orphan leases and stuck jobs from the DB-backed event queue.
import { NextRequest } from 'next/server';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { EventWorkerService } from '@/lib/events/worker';

export const maxDuration = 60; // Max execution time 60 seconds

export async function GET(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    // 1. Recover orphan leases (Processing but lease expired)
    // Actually, acquire_event_leases handles this naturally, 
    // but doing it explicitly here helps metrics and ensures they are cleanly reset 
    // if we want to run them separately.
    const { data: recoveredLeases, error: recoverErr } = await supabase
      .from('consumer_locks')
      .update({ 
        status: 'PENDING', 
        worker_id: null, 
        locked_at: null,
        locked_by: null,
        lease_expires_at: null,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('status', 'PROCESSING')
      .lt('lease_expires_at', new Date().toISOString())
      .select('id');

    if (recoverErr) {
      logger.error('Error recovering orphan leases', { error: recoverErr });
    }

    const recoveredCount = recoveredLeases?.length || 0;

    // 2. We can also trigger the worker to process any pending/recovered events
    // This acts as a fallback execution loop if real-time webhooks/triggers fail.
    const processedCount = await EventWorkerService.processBatch(50, 5);

    logger.info('Recovery cron complete', { recovered: recoveredCount, processed: processedCount });
    return Response.json({ recovered: recoveredCount, processed: processedCount, success: true });
  } catch (err: any) {
    logger.error('Recovery cron failed', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
