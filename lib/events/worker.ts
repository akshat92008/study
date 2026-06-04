import { createAdminClient } from '@/lib/supabase/admin';
import { withCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { Metrics } from '@/lib/observability/metrics';
import { EventConsumer, getConsumersForEvent } from './orchestrator';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { AtlasConsumer } from '@/lib/engines/cognition-graph';
import { MemoryConsumer } from '@/lib/engines/revision-engine';
import { ConceptExpansionConsumer } from '@/lib/engines/concept-expansion-engine';
import { processChatSideEffects, type ChatSideEffectsInput } from '@/lib/ai/chat-side-effects';
import { runAgenticConsumer } from '@/lib/agents/event-runner';
import { runCheapAgenticCycle } from '@/lib/agents/orchestrator';
import { featureFlags } from '@/lib/config/flags';
import { hermesRuntimeConfig } from '@/lib/hermes/hermes-runtime-config';

export const HANDLED_EVENT_CONSUMERS = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'autopsy_engine',
  'concept_expansion_engine',
  'chat_side_effect_engine',
  'rag_agent',
  'atlas_agent',
  'memory_agent',
  'planner_agent',
  'mind_agent',
  'autopsy_agent',
  'command_agent',
  // Hermes internal worker — never user-facing
  'hermes_worker',
] as const;


const MAX_RETRIES = 2; // Equivalent to retry_count < 3
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
  static async processBatch(limit: number = 25, leaseTimeoutMinutes: number = 5, maxRuntimeMs: number = 45000, startTimeMs: number = Date.now()) {
    const supabase = createAdminClient();
    const workerId = crypto.randomUUID();
    const actualLimit = Math.min(limit, 50);

    let leases: any[] = [];

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

    return await this.processLeasesWithBoundedConcurrency(leases, workerId, maxRuntimeMs, startTimeMs);
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

  private static async processLeasesWithBoundedConcurrency(leases: any[], workerId: string, maxRuntimeMs: number, startTimeMs: number) {
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
      agentCounts = await this.runCheapAgenticCycleForLease(lease);

      await withCorrelationId(traceId, async () => {
        result = await runAgenticConsumer(lease, () => this.routeToConsumer(lease));
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

  private static async runCheapAgenticCycleForLease(lease: any): Promise<AgentActionCounts> {
    const empty = {
      agentActionsApplied: 0,
      agentActionsProposed: 0,
      agentActionsSkipped: 0,
      agentActionsFailed: 0,
    };

    const consumers = getConsumersForEvent(lease.event_type);
    if (consumers[0] !== lease.consumer_name) return empty;
    if (!lease.user_id) {
      logger.warn('Cheap agentic cycle skipped: event lacks user_id', {
        eventId: lease.event_id,
        eventType: lease.event_type,
      });
      return { ...empty, agentActionsSkipped: 1 };
    }

    try {
      const result = await runCheapAgenticCycle({
        id: lease.event_id,
        userId: lease.user_id,
        type: lease.event_type,
        payload: lease.event_payload ?? {},
        createdAt: lease.event_created_at ?? lease.created_at ?? null,
      });
      return {
        agentActionsApplied: result.applied,
        agentActionsProposed: result.proposed,
        agentActionsSkipped: result.skipped,
        agentActionsFailed: result.failed,
      };
    } catch (error) {
      logger.warn('Cheap agentic cycle failed without aborting event consumer', {
        eventId: lease.event_id,
        eventType: lease.event_type,
        userId: lease.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...empty, agentActionsFailed: 1 };
    }
  }

  private static async handleConsumerFailure(lease: any, errorMsg: string, isPermanent: boolean = false) {
    const supabase = createAdminClient();
    const newRetryCount = Number(lease.retry_count ?? 0) + 1;
    const nextAttemptAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 10_000).toISOString();

    if (isPermanent || newRetryCount > MAX_RETRIES) {
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
    const consumer = lease.consumer_name as EventConsumer;
    if (!getConsumersForEvent(lease.event_type).includes(consumer)) {
      logger.warn('Event worker skipped stale consumer route', {
        feature: 'event-worker',
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
      });
      return {
        status: 'SKIPPED_STALE_ROUTE',
        reason: `${lease.consumer_name} is no longer registered for ${lease.event_type}`,
      };
    }

    const event = {
      id: lease.event_id,
      user_id: lease.user_id,
      type: lease.event_type,
      data: lease.event_payload,
      metadata: lease.event_metadata,
    };
    const payload = {
      ...(event.metadata ?? {}),
      ...(event.data ?? {}),
      eventId: lease.event_id,
      sourceEventId: lease.event_id,
    };

    switch (consumer) {
      case 'learning_state_engine': {
        if (event.type === 'STUDENT_MODEL_SYNC_REQUESTED') {
          const { syncStudentModel } = await import('@/lib/engines/inference-engine');
          await syncStudentModel(event.user_id, Boolean(payload.isInitialFingerprint), createAdminClient());
          const { invalidateSessionCard } = await import('@/lib/services/session-card-invalidation');
          await invalidateSessionCard(event.user_id, 'LEARNER_STATE_UPDATED', {
            skipVersionBump: false,
            client: createAdminClient(),
          }).catch((err: any) =>
            logger.warn('Daily synthesis: failed to invalidate session card', { userId: event.user_id, err })
          );
          return { status: 'HANDLED' };
        }
        if (['AUTOPSY_V3_REASONS_COLLECTED', 'AUTOPSY_V3_REPORT_READY', 'LEARNING_SIGNAL_INGESTED'].includes(event.type)) {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Event handled deterministically or is audit-only for learning_state_engine' };
        }
        const legacyType = this.mapToLegacyType(event.type);
        if (legacyType) {
          await LearningStateEngine.processLegacyEvent({
            userId: event.user_id,
            type: legacyType as any,
            data: payload,
          });
          return { status: 'HANDLED' };
        } else if (event.type === 'PRACTICE_ATTEMPT_RECORDED' || event.type === 'PRACTICE_ATTEMPT_SUBMITTED') {
          // Trigger a learning state invalidation/recalculation
          const { invalidateSessionCard } = await import('@/lib/services/session-card-invalidation');
          await invalidateSessionCard(event.user_id, 'LEARNER_STATE_UPDATED', {
            skipVersionBump: false,
            client: createAdminClient(),
          }).catch((err: any) =>
            logger.warn('Practice attempt: failed to invalidate session card', { userId: event.user_id, err })
          );
          return { status: 'HANDLED' };
        }
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'No learning-state projection for this event yet' };
      }
      case 'atlas_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED' || event.type === 'MOCK_TEST_ANALYZED') {
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, payload);
          return { status: 'HANDLED' };
        } else if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'MIND_TUTOR_COMPLETED' || event.type === 'REVISION_COMPLETED') {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, event.data);
          return { status: 'HANDLED' };
        } else if (event.type === 'MEMORY_CARD_REVIEWED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Card review updates ATLAS through mastery evidence writer' };
        } else if (event.type === 'PRACTICE_ATTEMPT_RECORDED' || event.type === 'PRACTICE_ATTEMPT_SUBMITTED') {
          await AtlasConsumer.handlePracticeAttempt(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        break;
      case 'memory_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED' || event.type === 'MOCK_TEST_ANALYZED') {
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, payload);
          return { status: 'HANDLED' };
        } else if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'MIND_TUTOR_COMPLETED' || event.type === 'REVISION_COMPLETED') {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, event.data);
          return { status: 'HANDLED' };
        } else if (event.type === 'PRACTICE_ATTEMPT_RECORDED' || event.type === 'PRACTICE_ATTEMPT_SUBMITTED') {
          await MemoryConsumer.handlePracticeAttempt(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        break;

      case 'autopsy_engine':
        if (event.type === 'AUTOPSY_UPLOAD_RECEIVED' || event.type === 'MOCK_TEST_UPLOADED') {
          if (!featureFlags.autopsyProcessing()) {
            return { status: 'SKIPPED_INTENTIONALLY', reason: 'Autopsy processing disabled by feature flag' };
          }
          if (!payload.jobId) return { status: 'SKIPPED_INTENTIONALLY', reason: 'No autopsy jobId provided' };
          const { processAutopsyJob } = await import('@/lib/services/autopsy-jobs');
          await processAutopsyJob(event.user_id, payload.jobId);
          return { status: 'HANDLED' };
        }
        break;
      case 'concept_expansion_engine':
        if (event.type === 'CONCEPT_DISCOVERED') {
          await ConceptExpansionConsumer.handleConceptDiscovered(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        break;
      case 'chat_side_effect_engine':
        if (event.type === 'CHAT_MESSAGE_PROCESSED') {
          const chatSideEffectsInput = this.buildChatSideEffectsInput(event.user_id, payload);
          await processChatSideEffects({
            supabase: createAdminClient(),
            ...chatSideEffectsInput,
          });
          return { status: 'HANDLED' };
        }
        if (event.type === 'CHAT_SESSION_SUMMARIZE') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'CHAT_SESSION_SUMMARIZE is currently audit-only/handled differently' };
        }
        if (event.type === 'CHAT_MESSAGE_CREATED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'CHAT_MESSAGE_CREATED is audited by the cheap agentic cycle' };
        }
        break;
      case 'rag_agent':
        if (event.type === 'MATERIAL_UPLOADED' || event.type === 'MATERIAL_INGESTION_REQUESTED') {
          return this.handleRagIngestionRequested(event.user_id, payload);
        }
        if (event.type === 'RAG_QUERY_USED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'RAG query usage is logged during retrieval' };
        }
        break;
      case 'atlas_agent':
        if (event.type === 'AUTOPSY_MISTAKE_APPROVED') {
          const rawMistakes = payload.wrongQuestions ?? [payload.mistake ?? payload];
          const wrongQuestions = rawMistakes.map((m: any) => ({ ...m, status: 'verified_mistake', needsReview: false, extractionConfidence: 100, confidence: 100 }));
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, {
            ...payload,
            wrongQuestions,
          });
          return { status: 'HANDLED' };
        }
        if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'SESSION_CARD_COMPLETED' || event.type === 'REVISION_COMPLETED') {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        if (event.type === 'REVISION_CARD_REVIEWED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Revision review is handled by MEMORY_CARD_REVIEWED projection' };
        }
        if (event.type === 'MATERIAL_INGESTED' || event.type === 'ATLAS_MASTERY_UPDATE_REQUESTED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'ATLAS agent wrapper registered; concrete handler is pending product-specific evidence mapping' };
        }
        if (event.type === 'LEARNING_SIGNAL_INGESTED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Event is audit-only for atlas_agent' };
        }
        break;
      case 'memory_agent':
        if (event.type === 'AUTOPSY_MISTAKE_APPROVED') {
          const rawMistakes = payload.wrongQuestions ?? [payload.mistake ?? payload];
          const wrongQuestions = rawMistakes.map((m: any) => ({ ...m, status: 'verified_mistake', needsReview: false, extractionConfidence: 100, confidence: 100 }));
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, {
            ...payload,
            wrongQuestions,
          });
          return { status: 'HANDLED' };
        }
        if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'SESSION_CARD_COMPLETED' || event.type === 'REVISION_COMPLETED') {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        if (event.type === 'RAG_CARD_CANDIDATE_CREATED' || event.type === 'MEMORY_CARD_CREATE_REQUESTED' || event.type === 'MATERIAL_INGESTED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'MEMORY agent wrapper registered; card extraction requires explicit source payload' };
        }
        if (event.type === 'REVISION_CARD_REVIEWED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'REVISION_CARD_REVIEWED handled elsewhere or audit-only for memory_agent' };
        }
        if (['AUTOPSY_V3_REPORT_READY', 'HERMES_MEMORY_UPDATED', 'LEARNING_SIGNAL_INGESTED'].includes(event.type)) {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Event handled deterministically or is audit-only for memory_agent' };
        }
        break;
      case 'planner_agent':
        if ([
          'MATERIAL_INGESTED',
          'AUTOPSY_MOCK_PROCESSED',
          'AUTOPSY_PROCESSING_COMPLETED',
          'TEST_ANALYSIS_COMPLETED',
          'AUTOPSY_MISTAKE_APPROVED',
          'STUDY_SESSION_COMPLETED',
          'MIND_TUTOR_COMPLETED',
          'MEMORY_CARD_REVIEWED',
          'REVISION_CARD_REVIEWED',
          'REVISION_COMPLETED',
          'ATLAS_MASTERY_UPDATED',
          'MEMORY_CARD_CREATED',
          'LEARNER_STATE_CHANGED',
          'SESSION_RECOMMENDATION_REQUESTED',
          'PLANNER_REPLAN_REQUESTED',
          'SESSION_CARD_COMPLETED',
          'PRACTICE_ATTEMPT_RECORDED',
          'PRACTICE_ATTEMPT_SUBMITTED',
          'ONBOARDING_QUIZ_COMPLETE',
          'AUTOPSY_V3_REPORT_READY',
          'HERMES_MEMORY_UPDATED',
          'LEARNING_SIGNAL_INGESTED',
        ].includes(event.type)) {
          const { invalidateSessionCard } = await import('@/lib/services/session-card-invalidation');
          await invalidateSessionCard(event.user_id, 'LEARNER_STATE_UPDATED', {
            client: createAdminClient(),
            sourceEventId: lease.event_id,
          });
          return { status: 'HANDLED' };
        }
        break;
      case 'mind_agent':
        if ([
          'CHAT_MESSAGE_PROCESSED',
          'CHAT_MESSAGE_CREATED',
          'CHAT_LEARNING_SIGNAL',
          'MIND_ACTION_REQUESTED',
          'MIND_CONTEXT_REFRESHED',
          'SESSION_RECOMMENDATION_CREATED',
          'LEARNER_STATE_CHANGED',
        ].includes(event.type)) {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'MIND context refresh is request-time; event is audited by agent runtime' };
        }
        break;
      case 'autopsy_agent':
        if ([
          'AUTOPSY_PROCESSING_COMPLETED',
          'TEST_ANALYSIS_COMPLETED',
          'AUTOPSY_MISTAKE_EXTRACTED',
          'AUTOPSY_MISTAKE_REJECTED',
          'AUTOPSY_V3_ASSESSMENT_CREATED',
          'AUTOPSY_V3_QUESTIONS_UPSERTED',
          'AUTOPSY_V3_REASONS_COLLECTED',
        ].includes(event.type)) {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'AUTOPSY agent event acknowledged; state mutation happens only on approval or via deterministic paths' };
        }
        break;
      case 'command_agent':
        if ([
          'MATERIAL_INGESTED',
          'AUTOPSY_MOCK_PROCESSED',
          'MOCK_TEST_ANALYZED',
          'TEST_ANALYSIS_COMPLETED',
          'AUTOPSY_MISTAKE_APPROVED',
          'STUDY_SESSION_COMPLETED',
          'MIND_TUTOR_COMPLETED',
          'MEMORY_CARD_REVIEWED',
          'REVISION_CARD_REVIEWED',
          'REVISION_COMPLETED',
          'ATLAS_MASTERY_UPDATED',
          'MEMORY_CARD_CREATED',
          'PLANNER_REPLAN_REQUESTED',
          'SESSION_CARD_COMPLETED',
          'PRACTICE_ATTEMPT_RECORDED',
          'PRACTICE_ATTEMPT_SUBMITTED',
          'ONBOARDING_QUIZ_COMPLETE',
          'AUTOPSY_V3_REPORT_READY',
          'LEARNING_SIGNAL_INGESTED',
        ].includes(event.type)) {
          return this.handleCommandAgentEvent(event, payload);
        }
        break;
      case 'hermes_worker':
        return this.handleHermesWorkerEvent(event, payload);
    }

    return { status: 'PERMANENT_FAILURE', reason: `Event routing error: ${consumer} has no handler for ${event.type}` };
  }

  private static async handleHermesWorkerEvent(
    event: any,
    payload: Record<string, any>
  ): Promise<ConsumerResult> {
    const { featureFlags } = await import('@/lib/config/flags');
    if (!hermesRuntimeConfig.hermesEnabled()) {
      return { status: 'SKIPPED_INTENTIONALLY', reason: 'Hermes is disabled (HERMES_ENABLED=false)' };
    }

    const { isHermesError } = await import('@/lib/hermes');

    if (event.type === 'HERMES_MISTAKE_REVIEW_REQUESTED') {
      // Async Hermes mistake processing via event queue
      // Only used if the route explicitly enqueues this event for deferred processing.
      // The synchronous path in manual/route.ts handles mistakes directly.
      try {
        const { runHermesMistakeAgent, buildMistakeFallback, writeMistakeResult } = await import('@/lib/hermes');
        const supabase = createAdminClient();

        const input = {
          userId: event.user_id,
          goalId: payload.goalId ?? null,
          chatSessionId: payload.chatSessionId ?? null,
          question: payload.question ?? '',
          myAnswer: payload.myAnswer ?? '',
          correctAnswer: payload.correctAnswer ?? '',
          explanation: payload.explanation ?? null,
        };

        let result;
        try {
          result = await runHermesMistakeAgent(input);
        } catch (hermesErr) {
          if (isHermesError(hermesErr)) {
            logger.warn('[hermes_worker] Mistake agent failed, using fallback', {
              userId: event.user_id,
              eventId: event.id,
            });
            result = buildMistakeFallback(input);
          } else {
            throw hermesErr;
          }
        }

        await writeMistakeResult(
          supabase,
          event.user_id,
          payload.goalId ?? null,
          payload.chatSessionId ?? null,
          input,
          result,
          event.id
        );

        return { status: 'HANDLED' };
      } catch (err: any) {
        logger.warn('[hermes_worker] HERMES_MISTAKE_REVIEW_REQUESTED failed', {
          userId: event.user_id,
          error: err.message,
        });
        return { status: 'RETRYABLE_FAILURE', reason: err.message };
      }
    }

    if (event.type === 'HERMES_SOURCE_PROCESS_REQUESTED') {
      // Deferred source processing
      const { getHermesConfig } = await import('@/lib/hermes');
      if (!getHermesConfig().sourceProcessingEnabled) {
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'Hermes source processing disabled' };
      }
      
      try {
        const { runHermesSourceAgent, writeSourceResult } = await import('@/lib/hermes');
        const supabase = createAdminClient();
        
        // Load material context (first 10 chunks)
        const { data: chunks } = await supabase
          .from('study_material_chunks')
          .select('text')
          .eq('material_id', payload.materialId)
          .order('chunk_index', { ascending: true })
          .limit(10);
          
        const materialContent = (chunks ?? []).map(c => c.text).join('\n\n');
        
        const result = await runHermesSourceAgent({
          userId: event.user_id,
          materialId: payload.materialId,
          title: payload.title ?? 'Untitled Material',
          compactChunks: (chunks ?? []).map(c => c.text),
        });
        
        await writeSourceResult(
          supabase,
          event.user_id,
          payload.materialId,
          payload.goalId ?? null,
          result,
          true,
          event.id
        );
        return { status: 'HANDLED' };
      } catch (err: any) {
        logger.warn('[hermes_worker] HERMES_SOURCE_PROCESS_REQUESTED failed', {
          userId: event.user_id,
          error: err.message,
        });
        return { status: 'RETRYABLE_FAILURE', reason: err.message };
      }
    }

    if (event.type === 'HERMES_REVISION_QUALITY_REQUESTED') {
      const { getHermesConfig } = await import('@/lib/hermes');
      if (!getHermesConfig().revisionQualityEnabled) {
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'Hermes revision quality disabled' };
      }
      
      try {
        const supabase = createAdminClient();
        const goalId = payload.goalId;
        const batchSize = payload.batchSize ?? 5;
        
        const { data: cards } = await supabase
          .from('revision_cards')
          .select('id, front, back')
          .eq('user_id', event.user_id)
          .eq('goal_id', goalId)
          .eq('state', 0)
          .is('metadata->hermesImproved', null)
          .is('metadata->hermesRejected', null)
          .limit(batchSize);
          
        if (!cards || cards.length === 0) {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'No cards to improve' };
        }
        
        const { runHermesRevisionAgent, writeRevisionQualityResult } = await import('@/lib/hermes');
        const result = await runHermesRevisionAgent({
          userId: event.user_id,
          goalId,
          draftCards: cards.map(c => ({
            cardId: c.id,
            front: c.front,
            back: c.back,
            type: 'mistake_concept',
            difficulty: 'medium'
          })),
          context: payload.context ?? '',
        });
        
        await writeRevisionQualityResult(supabase, event.user_id, goalId, result);
        return { status: 'HANDLED' };
      } catch (err: any) {
        logger.warn('[hermes_worker] HERMES_REVISION_QUALITY_REQUESTED failed', {
          userId: event.user_id,
          error: err.message,
        });
        return { status: 'RETRYABLE_FAILURE', reason: err.message };
      }
    }

    if (event.type === 'HERMES_TRACE_REQUESTED') {
      const { getHermesConfig } = await import('@/lib/hermes');
      if (!getHermesConfig().traceEnabled) {
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'Hermes trace disabled' };
      }
      try {
        const supabase = createAdminClient();
        const goalId = payload.goalId;
        if (!goalId) {
          return { status: 'PERMANENT_FAILURE', reason: 'HERMES_TRACE_REQUESTED missing goalId' };
        }

        const { data: mistakes } = await supabase
          .from('mistakes')
          .select('category, subject, chapter, topic')
          .eq('user_id', event.user_id)
          .eq('goal_id', goalId)
          .order('created_at', { ascending: false })
          .limit(10);

        const { data: dueCards } = await supabase
          .from('revision_cards')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', event.user_id)
          .eq('goal_id', goalId)
          .lte('due', new Date().toISOString());

        const { data: weakConcepts } = await supabase
          .from('concepts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', event.user_id)
          .eq('goal_id', goalId)
          .in('mastery', ['not_started', 'exposed', 'developing']);

        const { runHermesTraceAgent, writeTraceResult } = await import('@/lib/hermes');
        const result = await runHermesTraceAgent({
          userId: event.user_id,
          goalId,
          recentMistakes: mistakes ?? [],
          dueCardsCount: (dueCards as any)?.count ?? 0,
          weakConceptsCount: (weakConcepts as any)?.count ?? 0,
          recentActivity: [],
        });
        
        await writeTraceResult(supabase, event.user_id, goalId, result);
        return { status: 'HANDLED' };
      } catch (err: any) {
        logger.warn('[hermes_worker] HERMES_TRACE_REQUESTED failed', {
          userId: event.user_id,
          error: err.message,
        });
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'Trace agent failed — non-critical' };
      }
    }

    if (event.type === 'HERMES_NEXT_ACTION_REQUESTED') {
      const { getHermesConfig } = await import('@/lib/hermes');
      if (!getHermesConfig().nextActionEnabled) {
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'Hermes next action disabled' };
      }
      try {
        const supabase = createAdminClient();
        const goalId = payload.goalId;
        if (!goalId) {
          return { status: 'PERMANENT_FAILURE', reason: 'HERMES_NEXT_ACTION_REQUESTED missing goalId' };
        }
        
        const { data: goalData } = await supabase
          .from('learning_goals')
          .select('metadata')
          .eq('id', goalId)
          .single();
          
        const { runHermesNextActionAgent, writeNextActionResult } = await import('@/lib/hermes');
        const result = await runHermesNextActionAgent({
          userId: event.user_id,
          goalId,
          goalTitle: (goalData?.metadata as any)?.title ?? 'Untitled Goal',
          weakConceptsCount: payload.weakConceptsCount ?? 0,
          dueCardsCount: payload.dueCardsCount ?? 0,
          recentMistakesCount: payload.recentMistakesCount ?? 0,
          pendingTasksCount: payload.pendingTasksCount ?? 0,
          recentSources: payload.recentSources ?? [],
        });
        
        await writeNextActionResult(supabase, event.user_id, goalId, result, event.id);
        return { status: 'HANDLED' };
      } catch (err: any) {
        logger.warn('[hermes_worker] HERMES_NEXT_ACTION_REQUESTED failed', {
          userId: event.user_id,
          error: err.message,
        });
        return { status: 'RETRYABLE_FAILURE', reason: err.message };
      }
    }

    if (['AUTOPSY_V3_REASONS_COLLECTED', 'AUTOPSY_V3_REPORT_READY'].includes(event.type)) {
      return { status: 'SKIPPED_INTENTIONALLY', reason: 'Event handled deterministically or is audit-only for hermes_worker' };
    }

    return { status: 'SKIPPED_INTENTIONALLY', reason: `hermes_worker: no handler for ${event.type}` };
  }

  private static async handleCommandAgentEvent(event: any, payload: Record<string, any>): Promise<ConsumerResult> {
    const supabase = createAdminClient();
    const date = typeof payload.date === 'string' && payload.date
      ? payload.date
      : new Date().toISOString().slice(0, 10);

    const { runDailySynthesisForUser } = await import('@/lib/services/command-plan.service');
    const plan = await runDailySynthesisForUser({
      userId: event.user_id,
      date,
      goalId: payload.goalId || payload.goal_id,
      client: supabase,
    });

    const { recordAgentAction } = await import('@/lib/agents/agent-runtime');
    await recordAgentAction({
      userId: event.user_id,
      agentName: 'command',
      actionType: 'adjust_next_session',
      targetType: 'daily_plan',
      status: 'applied',
      confidence: 0.95,
      evidence: {
        date,
        eventId: event.id,
        eventType: event.type,
        taskCount: plan.tasks.length,
        created: plan.created,
        sourceSignals: plan.sourceSignals,
      },
      reason: `COMMAND reconciled the daily plan after ${event.type}.`,
      idempotencyKey: `command_reconcile:${event.id}:${event.type}`,
    }, { client: supabase }).catch((err: any) => {
      logger.warn('COMMAND decision action write failed', {
        userId: event.user_id,
        eventId: event.id,
        eventType: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    const { invalidateSessionCard } = await import('@/lib/services/session-card-invalidation');
    await invalidateSessionCard(event.user_id, 'LEARNER_STATE_UPDATED', {
      client: supabase,
      sourceEventId: event.id,
      skipVersionBump: true,
      goalId: payload.goalId || payload.goal_id,
    });

    return {
      status: 'HANDLED',
      reason: plan.created
        ? 'COMMAND created a daily plan and invalidated the session card'
        : 'COMMAND reconciled the existing daily plan and invalidated the session card',
    };
  }

  private static async handleRagIngestionRequested(userId: string, payload: Record<string, any>): Promise<ConsumerResult> {
    if (!featureFlags.ragIngestion()) {
      return { status: 'SKIPPED_INTENTIONALLY', reason: 'RAG ingestion disabled by feature flag' };
    }
    const materialId = this.requireNonEmptyString(payload.materialId ?? payload.material_id, 'event_payload.materialId');
    const supabase = createAdminClient();

    const { data: material, error: materialError } = await supabase
      .from('study_materials')
      .select('id, storage_path, mime_type, status')
      .eq('id', materialId)
      .eq('user_id', userId)
      .maybeSingle();

    if (materialError) throw materialError;
    if (!material) return { status: 'SKIPPED_INTENTIONALLY', reason: 'Material not found for user' };
    if (material.status === 'ready') return { status: 'SKIPPED_INTENTIONALLY', reason: 'Material already ingested' };
    if (material.status === 'processing') return { status: 'SKIPPED_INTENTIONALLY', reason: 'Material ingestion already in progress' };
    if (!material.storage_path) return { status: 'SKIPPED_INTENTIONALLY', reason: 'Material has no storage path' };

    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('study-materials')
      .download(material.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`RAG material download failed: ${downloadError?.message ?? 'missing file data'}`);
    }

    const { ingestStudyMaterial } = await import('@/lib/rag/ingest');
    await ingestStudyMaterial({
      materialId,
      userId,
      buffer: Buffer.from(await fileData.arrayBuffer()),
      mimeType: material.mime_type,
    });

    return { status: 'HANDLED' };
  }

  private static buildChatSideEffectsInput(
    eventUserId: unknown,
    payload: Record<string, any>
  ): Omit<ChatSideEffectsInput, 'supabase'> {
    const userId = this.requireNonEmptyString(eventUserId, 'event.user_id');
    const sessionId = this.requireNonEmptyString(payload.sessionId, 'event_payload.sessionId');
    const message = this.requireNonEmptyString(payload.message, 'event_payload.message');
    const fullResponse = this.requireString(payload.fullResponse, 'event_payload.fullResponse');

    return {
      // userId is intentionally sourced only from the event envelope. The payload
      // may be stale or malicious; it must never override the leased event user.
      userId,
      sessionId,
      message,
      fullResponse,
      emotion: typeof payload.emotion === 'string' && payload.emotion.trim()
        ? payload.emotion
        : 'neutral',
      history: Array.isArray(payload.history) ? payload.history : [],
      sessionTurnsCount: Number.isFinite(payload.sessionTurnsCount)
        ? Number(payload.sessionTurnsCount)
        : 0,
      mindContext: payload.mindContext ?? null,
      intent: payload.intent && typeof payload.intent === 'object'
        ? payload.intent
        : { intent: 'GENERAL_CHAT' },
      metadataPayload: payload.metadataPayload,
      assistant_message_id: typeof payload.assistant_message_id === 'string'
        ? payload.assistant_message_id
        : undefined,
      user_message_id: typeof payload.user_message_id === 'string'
        ? payload.user_message_id
        : undefined,
      source_type: typeof payload.source_type === 'string'
        ? payload.source_type
        : 'global_chat',
    };
  }

  private static requireNonEmptyString(value: unknown, field: string): string {
    const text = this.requireString(value, field);
    if (!text.trim()) {
      throw new Error(`CHAT_MESSAGE_PROCESSED missing ${field}`);
    }
    return text;
  }

  private static requireString(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      throw new Error(`CHAT_MESSAGE_PROCESSED missing ${field}`);
    }
    return value;
  }

  private static mapToLegacyType(type: string): string | null {
    switch (type) {
      case 'MIND_TUTOR_COMPLETED':
      case 'STUDY_SESSION_COMPLETED':
        return 'SESSION_COMPLETED';
      case 'MEMORY_CARD_REVIEWED':
        return 'CARD_REVIEWED';
      default:
        return type;
    }
  }
}
