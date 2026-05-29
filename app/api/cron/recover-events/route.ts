// app/api/cron/recover-events/route.ts
// Run every 15 minutes via Vercel Cron — much faster than the daily cron.
// Recovers consumers dropped by after() and retries failed events.
import { NextRequest } from 'next/server';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { recoverStaleConsumers } from '@/lib/events/retry';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 30; // Short cron — 30 seconds max

export async function GET(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    // 1. Recover stale consumers (dropped by after())
    const { recovered } = await recoverStaleConsumers();

    // 2. Find pending consumers whose events need re-dispatch
    const { data: pendingConsumers } = await supabase
      .from('event_consumer_tracking')
      .select('event_id')
      .eq('status', 'pending')
      .limit(20); // Process up to 20 events per cycle

    const uniqueEventIds = [...new Set((pendingConsumers || []).map((c: any) => c.event_id))];

    let dispatched = 0;
    for (const eventId of uniqueEventIds) {
      try {
        await EventDispatcher.runAllConsumers(eventId);
        dispatched++;
      } catch (err) {
        logger.warn('Failed to dispatch event in recovery cron', { eventId, err });
      }
    }

    logger.info('Recovery cron complete', { recovered, dispatched });
    return Response.json({ recovered, dispatched, success: true });
  } catch (err: any) {
    logger.error('Recovery cron failed', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
