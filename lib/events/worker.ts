import { createAdminClient } from '@/lib/supabase/admin';
import { withCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { Metrics } from '@/lib/observability/metrics';
import { EventConsumer, getConsumersForEvent } from './orchestrator';
// Mutations removed: Learner state projection is now handled synchronously in the core loop.

export const HANDLED_EVENT_CONSUMERS = [
  'downstream_publisher_kafka',
  'downstream_publisher_qstash'
] as const;


const DEFAULT_MAX_RETRIES = 2; // Equivalent to retry_count < 3
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 10;

type ConsumerResultStatus = 'HANDLED' | 'SKIPPED_INTENTIONALLY' | 'SKIPPED_STALE_ROUTE' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE';

type ConsumerResult = {
  status: ConsumerResultStatus;
  reason?: string;
};

type AgentActionCounts = {
  agentActionsApplied: number;
  agentActionsProposed: number;
  agentActionsSkipped: number;
  agentActionsFailed: number;
};

type ProcessLeaseOutcome = AgentActionCounts & {
  success: boolean;
};

type QueueHealthSummary = {
  pendingEvents: number;
  processingEvents: number;
  failedEvents: number;
  pendingLocks: number;
  processingLocks: number;
  failedLocks: number;
  dlqCount: number;
  oldestPendingAgeSeconds: number;
  staleRouteSkips: number;
  averageAttempts: number;
  errors: string[];
  timestamp: string;
};

export class EventWorkerService {
  /**
   * Processes a batch of events by acquiring a lease and routing to the respective consumer.
   */
  static async processBatch(limit: number = 25, leaseTimeoutMinutes: number = 5, maxRuntimeMs: number = 45000, startTimeMs: number = Date.now(), maxAiCalls: number = 3) {
    const supabase = createAdminClient();
    const workerId = crypto.randomUUID();
    const actualLimit = Math.min(limit, 50);

    let leases: any[] = [];
    // Legacy background process handling removed.

    // 1. Acquire Leases from Postgres
    const { data: dbLeases, error: leaseErr } = await supabase.rpc('acquire_event_leases', {
      p_worker_id: workerId,
      p_limit: actualLimit,
      p_lease_timeout: `${leaseTimeoutMinutes} minutes`,
    });

    if (leaseErr) {
      logger.error('Failed to acquire event leases', { error: leaseErr });
      throw leaseErr;
    }
    leases = (dbLeases || []).map((l: any) => ({ ...l, _source: 'postgres' }));

    if (!leases || leases.length === 0) {
      return {
        processed: 0,
        failed: 0,
        skipped: 0,
        agentActionsApplied: 0,
        agentActionsProposed: 0,
        agentActionsSkipped: 0,
        agentActionsFailed: 0,
      }; // No events to process
    }
    logger.info('Event worker leases acquired', {
      workerId,
      feature: 'event-worker',
      leaseCount: leases.length,
    });

    return await this.processLeasesWithBoundedConcurrency(leases, workerId, maxRuntimeMs, startTimeMs, maxAiCalls);
  }

  static async processSafeUserEvents(userId: string, maxEvents: number = 2) {
    const supabase = createAdminClient();
    const workerId = `opportunistic:${crypto.randomUUID()}`;
    const envCap = Number(process.env.EVENT_WORKER_MAX_EVENTS_PER_USER_PER_RUN ?? 3);
    const actualLimit = Math.max(1, Math.min(Math.floor(maxEvents), Number.isFinite(envCap) ? Math.floor(envCap) : 3, 3));
    const startTimeMs = Date.now();
    const maxRuntimeMs = 1_500;

    const { data: dbLeases, error } = await supabase.rpc('acquire_event_leases_for_user', {
      p_user_id: userId,
      p_worker_id: workerId,
      p_limit: actualLimit,
      p_lease_timeout: '2 minutes',
    });

    if (error) {
      logger.warn('Opportunistic user event lease failed', {
        userId,
        error: error.message,
        feature: 'event-worker',
      });
      return {
        processed: 0,
        failed: 0,
        skipped: 0,
        agentActionsApplied: 0,
        agentActionsProposed: 0,
        agentActionsSkipped: 0,
        agentActionsFailed: 1,
      };
    }

    const leases = (dbLeases || []).map((lease: any) => ({ ...lease, _source: 'postgres' }));
    if (leases.length === 0) {
      return {
        processed: 0,
        failed: 0,
        skipped: 0,
        agentActionsApplied: 0,
        agentActionsProposed: 0,
        agentActionsSkipped: 0,
        agentActionsFailed: 0,
      };
    }

    return this.processLeasesWithBoundedConcurrency(leases, workerId, maxRuntimeMs, startTimeMs, 2);
  }

  static async getHealthSummary(): Promise<QueueHealthSummary> {
    const supabase = createAdminClient();
    const now = Date.now();

    const [
      pending,
      processing,
      failed,
      pendingLocks,
      processingLocks,
      failedLocks,
      dlq,
      oldestPending,
      staleRouteSkips,
      retrySample,
    ] = await Promise.all([
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'PARTIAL_FAILED']),
      supabase.from('consumer_locks').select('*', { count: 'exact', head: true }).in('status', ['PENDING', 'RETRY_SCHEDULED']),
      supabase.from('consumer_locks').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      supabase.from('consumer_locks').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DLQ']),
      supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      supabase.from('event_queue').select('created_at').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('event_attempts').select('*', { count: 'exact', head: true }).eq('result_status', 'SKIPPED_STALE_ROUTE'),
      supabase.from('consumer_locks').select('retry_count').order('updated_at', { ascending: false }).limit(1000),
    ]);

    const oldestCreatedAt = oldestPending.data?.created_at
      ? new Date(oldestPending.data.created_at).getTime()
      : null;
    const retryRows = retrySample.data ?? [];
    const averageAttempts = retryRows.length > 0
      ? retryRows.reduce((sum: number, row: any) => sum + Number(row.retry_count ?? 0), 0) / retryRows.length
      : 0;
    const errors = [
      pending.error,
      processing.error,
      failed.error,
      pendingLocks.error,
      processingLocks.error,
      failedLocks.error,
      dlq.error,
      oldestPending.error,
      staleRouteSkips.error,
      retrySample.error,
    ].filter(Boolean).map((error: any) => error.message);

    return {
      pendingEvents: pending.count || 0,
      processingEvents: processing.count || 0,
      failedEvents: failed.count || 0,
      pendingLocks: pendingLocks.count || 0,
      processingLocks: processingLocks.count || 0,
      failedLocks: failedLocks.count || 0,
      dlqCount: dlq.count || 0,
      oldestPendingAgeSeconds: oldestCreatedAt ? Math.max(0, Math.round((now - oldestCreatedAt) / 1000)) : 0,
      staleRouteSkips: staleRouteSkips.count || 0,
      averageAttempts: Math.round(averageAttempts * 100) / 100,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  private static async processLeasesWithBoundedConcurrency(leases: any[], workerId: string, maxRuntimeMs: number, startTimeMs: number, maxAiCalls: number = 3) {
    const concurrency = this.getConcurrencyLimit();
    let nextIndex = 0;
    
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    let agentActionsApplied = 0;
    let agentActionsProposed = 0;
    let agentActionsSkipped = 0;
    let agentActionsFailed = 0;

    const supabase = createAdminClient();

    const workers = Array.from({ length: Math.min(concurrency, leases.length) }, async () => {
      while (nextIndex < leases.length) {
        if (Date.now() - startTimeMs >= maxRuntimeMs) {
          break; // Let the loop exit, we will skip the rest
        }
        if (agentActionsApplied + agentActionsProposed + agentActionsFailed >= maxAiCalls) {
          logger.info('Event worker reached max AI calls per run, breaking early', { feature: 'event-worker', maxAiCalls });
          break;
        }

        const lease = leases[nextIndex++];
        const outcome = await this.processLease(lease, workerId);
        agentActionsApplied += outcome.agentActionsApplied;
        agentActionsProposed += outcome.agentActionsProposed;
        agentActionsSkipped += outcome.agentActionsSkipped;
        agentActionsFailed += outcome.agentActionsFailed;
        if (outcome.success) {
          processed++;
        } else {
          failed++;
        }
      }
    });

    await Promise.all(workers);

    // Any leases that were not processed due to timeout must be released
    const skippedLeases = leases.slice(nextIndex);
    if (skippedLeases.length > 0) {
      skipped = skippedLeases.length;
      logger.warn('Worker time limit reached, releasing skipped leases', { feature: 'event-worker', skippedCount: skipped });
      const lockIds = skippedLeases.map(l => l.lock_id);
      
      await supabase
        .from('consumer_locks')
        .update({
          status: 'PENDING',
          locked_at: null,
          locked_by: null,
          lease_expires_at: null
        })
        .in('id', lockIds);
    }

    return {
      processed,
      failed,
      skipped,
      agentActionsApplied,
      agentActionsProposed,
      agentActionsSkipped,
      agentActionsFailed,
    };
  }

  private static getConcurrencyLimit() {
    const configured = Number(process.env.EVENT_WORKER_CONCURRENCY ?? DEFAULT_CONCURRENCY);
    if (!Number.isFinite(configured)) return DEFAULT_CONCURRENCY;
    return Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(configured)));
  }

  private static async processLease(lease: any, workerId: string): Promise<ProcessLeaseOutcome> {
    const supabase = createAdminClient();
    const start = Date.now();
    const traceId = lease.event_metadata?.trace_id || lease.event_id;
    logger.info('Event consumer started', {
      workerId,
      traceId,
      feature: 'event-worker',
      eventId: lease.event_id,
      eventType: lease.event_type,
      consumer: lease.consumer_name,
    });

    const { data: attempt } = await supabase
      .from('event_attempts')
      .insert({
        consumer_lock_id: lease.lock_id,
        event_id: lease.event_id,
        consumer_name: lease.consumer_name,
        worker_id: workerId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    let result: ConsumerResult = { status: 'HANDLED' };
    let agentCounts: AgentActionCounts = {
      agentActionsApplied: 0,
      agentActionsProposed: 0,
      agentActionsSkipped: 0,
      agentActionsFailed: 0,
    };
    try {
      await withCorrelationId(traceId, async () => {
        result = await this.routeToConsumer(lease);
      });

      Metrics.eventConsumer(lease.consumer_name, lease.event_type, Date.now() - start, true);

      if (result.status === 'PERMANENT_FAILURE' || result.status === 'RETRYABLE_FAILURE') {
        throw new Error(result.reason || `Consumer returned ${result.status}`);
      }

      if (lease._source === 'postgres') {
        await supabase
          .from('consumer_locks')
          .update({
            status: 'COMPLETED',
            locked_at: null,
            locked_by: null,
            lease_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lease.lock_id);
      }

      if (attempt) {
        await supabase
          .from('event_attempts')
          .update({
            finished_at: new Date().toISOString(),
            result_status: result.status,
            result_reason: result.reason ?? null,
          })
          .eq('id', attempt.id);
      }

      await this.checkParentEventCompletion(lease.event_id);
      logger.info('Event consumer completed', {
        workerId,
        traceId,
        feature: 'event-worker',
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
        durationMs: Date.now() - start,
        resultStatus: result.status,
      });
      return { success: true, ...agentCounts };
    } catch (err: any) {
      Metrics.eventConsumer(lease.consumer_name, lease.event_type, Date.now() - start, false);
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isPermanent = result.status === 'PERMANENT_FAILURE';

      Metrics.captureError(err instanceof Error ? err : new Error(errorMsg), {
        consumer: lease.consumer_name,
        event_type: lease.event_type,
        event_id: lease.event_id
      });

      if (attempt) {
        await supabase
          .from('event_attempts')
          .update({
            error_message: errorMsg,
            finished_at: new Date().toISOString()
          })
          .eq('id', attempt.id);
      }

      await this.handleConsumerFailure(lease, errorMsg, isPermanent);
      logger.warn('Event consumer failed', {
        workerId,
        traceId,
        feature: 'event-worker',
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
        durationMs: Date.now() - start,
        error: errorMsg,
      });
      return { success: false, ...agentCounts };
    }
  }



  private static async handleConsumerFailure(lease: any, errorMsg: string, isPermanent: boolean = false) {
    const supabase = createAdminClient();
    const newRetryCount = Number(lease.retry_count ?? 0) + 1;
    const nextAttemptAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 10_000).toISOString();

    if (isPermanent || newRetryCount > getMaxRetriesPerJob()) {
      // Move to DLQ
      await supabase.from('event_dlq').insert({
        event_id: lease.event_id,
        user_id: lease.user_id,
        consumer_name: lease.consumer_name,
        event_type: lease.event_type,
        payload: lease.event_payload,
        event_metadata: lease.event_metadata,
        attempts: newRetryCount,
        last_attempt_at: new Date().toISOString(),
        last_error: errorMsg,
      });
      
      Metrics.eventRetry(lease.consumer_name, newRetryCount, true);
      logger.warn('Event consumer moved to DLQ', {
        feature: 'event-worker',
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
        retryCount: newRetryCount,
      });

      // Update lock to DLQ if from Postgres
      if (lease._source === 'postgres') {
        await supabase
          .from('consumer_locks')
          .update({
            status: 'DLQ',
            retry_count: newRetryCount,
            last_error: errorMsg,
            locked_at: null,
            locked_by: null,
            lease_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lease.lock_id);
      }

      // Check if this makes parent fail completely
      await this.checkParentEventCompletion(lease.event_id);
    } else {
      // Schedule Retry (Exponential backoff)
      const nextRetryAt = nextAttemptAt;

      Metrics.eventRetry(lease.consumer_name, newRetryCount, false);
      logger.warn('Event consumer retry scheduled', {
        feature: 'event-worker',
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
        retryCount: newRetryCount,
        nextRetryAt,
      });

      await supabase
        .from('consumer_locks')
        .update({
          status: 'RETRY_SCHEDULED',
            retry_count: newRetryCount,
            next_retry_at: nextRetryAt,
            next_attempt_at: nextRetryAt,
            last_error: errorMsg,
            locked_at: null,
            locked_by: null,
            lease_expires_at: null, // release lease
            updated_at: new Date().toISOString(),
          })
          .eq('id', lease.lock_id);


      await this.checkParentEventCompletion(lease.event_id);
    }
  }

  private static async checkParentEventCompletion(eventId: string) {
    const supabase = createAdminClient();
    
    // Parent event status is a summary of per-consumer locks. Retry counts live
    // on consumer_locks so one failing consumer cannot erase successful ones.
    const { data: locks } = await supabase
      .from('consumer_locks')
      .select('status')
      .eq('event_id', eventId);

    if (locks && locks.length > 0) {
      const allCompleted = locks.every(l => l.status === 'COMPLETED');
      const anyProcessing = locks.some(l => l.status === 'PROCESSING');
      const anyPending = locks.some(l => l.status === 'PENDING' || l.status === 'RETRY_SCHEDULED');
      const anyCompleted = locks.some(l => l.status === 'COMPLETED');
      const anyFailed = locks.some(l => l.status === 'DLQ' || l.status === 'FAILED');
      const allTerminal = locks.every(l => l.status === 'COMPLETED' || l.status === 'DLQ' || l.status === 'FAILED');

      const status = allCompleted
        ? 'COMPLETED'
        : anyProcessing
          ? 'PROCESSING'
          : anyPending
            ? 'PENDING'
            : allTerminal && anyCompleted && anyFailed
              ? 'PARTIAL_FAILED'
              : allTerminal && anyFailed
                ? 'FAILED'
                : 'PENDING';

      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (!anyProcessing) {
        updatePayload.locked_at = null;
        updatePayload.locked_by = null;
      }

      await supabase
        .from('event_queue')
        .update(updatePayload)
        .eq('id', eventId);
    }
  }

  private static async routeToConsumer(lease: any): Promise<ConsumerResult> {
    const consumer = lease.consumer_name;
    const event = {
      id: lease.event_id,
      user_id: lease.user_id,
      type: lease.event_type,
      data: lease.event_payload,
      metadata: lease.event_metadata,
    };

    // Strict Domain Event Publisher
    // Learner-state mutations are handled synchronously by the atomic RPC outbox.
    // The worker strictly publishes domain events to downstream systems.
    try {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (qstashToken) {
        await fetch(`https://qstash.upstash.io/v2/publish/${process.env.QSTASH_TOPIC ?? 'events'}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
      } else {
        // Mock QStash publish
      }
      return { status: 'HANDLED' };
    } catch (err) {
      return { status: 'RETRYABLE_FAILURE', reason: 'Publish failed' };
    }
  }

}

function getMaxRetriesPerJob() {
  const configured = Number(process.env.MAX_AGENT_RETRIES_PER_JOB ?? DEFAULT_MAX_RETRIES);
  if (!Number.isFinite(configured)) return DEFAULT_MAX_RETRIES;
  return Math.max(0, Math.min(10, Math.floor(configured)));
}
