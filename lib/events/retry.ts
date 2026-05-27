import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Retries all failed events that haven't exceeded MAX_RETRIES.
 * Call this from the daily-synthesis cron and from the events/process route.
 */
export async function retryFailedEvents(userId?: string): Promise<{
  retried: number;
  succeeded: number;
  permanentlyFailed: number;
}> {
  const supabase = await createClient();

  // Fetch failed events with retries remaining
  let query = supabase
    .from('student_events')
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(50);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: failedEvents, error } = await query;

  if (error) {
    logger.error('Failed to fetch failed events for retry', error);
    return { retried: 0, succeeded: 0, permanentlyFailed: 0 };
  }

  if (!failedEvents || failedEvents.length === 0) {
    return { retried: 0, succeeded: 0, permanentlyFailed: 0 };
  }

  let succeeded = 0;
  let permanentlyFailed = 0;

  for (const event of failedEvents) {
    const delay = BASE_DELAY_MS * Math.pow(2, event.retry_count);
    await new Promise(r => setTimeout(r, Math.min(delay, 8000)));

    try {
      // Mark as processing
      await supabase
        .from('student_events')
        .update({ status: 'processing', retry_count: event.retry_count + 1 })
        .eq('id', event.id);

      // Re-dispatch the event to the processing endpoint
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/events/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-cron': process.env.CRON_SECRET || '',
        },
        body: JSON.stringify({ eventId: event.id }),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.ok) {
        await supabase
          .from('student_events')
          .update({ status: 'completed' })
          .eq('id', event.id);
        succeeded++;
        logger.info('Event retry succeeded', { eventId: event.id, type: event.type });
      } else {
        const retryCount = event.retry_count + 1;
        const finalStatus = retryCount >= MAX_RETRIES ? 'failed' : 'failed';
        await supabase
          .from('student_events')
          .update({
            status: finalStatus,
            retry_count: retryCount,
            last_error: `HTTP ${response.status} on retry`,
          })
          .eq('id', event.id);

        if (retryCount >= MAX_RETRIES) {
          permanentlyFailed++;
          logger.error('Event permanently failed after max retries', {
            eventId: event.id,
            type: event.type,
            userId: event.user_id,
          });
        }
      }
    } catch (err: any) {
      await supabase
        .from('student_events')
        .update({
          status: 'failed',
          retry_count: (event.retry_count || 0) + 1,
          last_error: err.message || 'unknown',
        })
        .eq('id', event.id);
      logger.error('Event retry threw', { eventId: event.id, err: err.message });
    }
  }

  return {
    retried: failedEvents.length,
    succeeded,
    permanentlyFailed,
  };
}

/**
 * Returns a count of permanently failed events (retry_count >= MAX_RETRIES, status: failed).
 * Use this in /api/ai/health to surface dead events to ops.
 */
export async function getDeadLetterCount(userId?: string): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from('student_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('retry_count', MAX_RETRIES);

  if (userId) query = query.eq('user_id', userId);

  const { count } = await query;
  return count || 0;
}
