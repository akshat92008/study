import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { EventWorkerService } from '@/lib/events/worker';
import { EVENT_CONSUMERS } from '@/lib/events/orchestrator';

export async function retryFailedEvents(): Promise<{
  retried: number;
  succeeded: number;
  permanentlyFailed: number;
}> {
  const processed = await EventWorkerService.processBatch(50, 5);
  return { retried: processed, succeeded: processed, permanentlyFailed: 0 };
}

export async function getDeadLetterCount(userId?: string): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from('event_dlq')
    .select('id', { count: 'exact', head: true });

  if (userId) query = query.eq('user_id', userId);

  const { count, error } = await query;
  if (error) {
    logger.warn('Failed to read event DLQ count', error);
    return 0;
  }

  return count || 0;
}

export async function recoverStaleConsumers(): Promise<{ recovered: number }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('consumer_locks')
    .update({
      status: 'PENDING',
      worker_id: null,
      locked_at: null,
      locked_by: null,
      lease_expires_at: null,
      next_attempt_at: now,
      updated_at: now,
    })
    .eq('status', 'PROCESSING')
    .lt('lease_expires_at', now)
    .select('id');

  if (error) {
    logger.warn('Failed to recover stale consumer locks', error);
    return { recovered: 0 };
  }

  return { recovered: data?.length || 0 };
}

export async function recoverOrphanedEvents(): Promise<{ recovered: number }> {
  const supabase = createAdminClient();

  const { data: events, error } = await supabase
    .from('event_queue')
    .select('id')
    .in('status', ['PENDING', 'PROCESSING'])
    .limit(100);

  if (error || !events?.length) return { recovered: 0 };

  let recovered = 0;
  for (const event of events) {
    const { count } = await supabase
      .from('consumer_locks')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id);

    if ((count || 0) > 0) continue;

    const rows = EVENT_CONSUMERS.map((consumer) => ({
      event_id: event.id,
      consumer_name: consumer,
      status: 'PENDING',
      next_retry_at: new Date().toISOString(),
      next_attempt_at: new Date().toISOString(),
    }));

    const { error: rpcError } = await supabase
      .from('consumer_locks')
      .insert(rows);

    if (!rpcError) recovered++;
  }

  return { recovered };
}
