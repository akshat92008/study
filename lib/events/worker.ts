import { createAdminClient } from '@/lib/supabase/admin';
import { withCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { Metrics } from '@/lib/observability/metrics';
import { assertEventConsumerRoute, EventConsumer } from './orchestrator';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { AtlasConsumer } from '@/lib/engines/cognition-graph';
import { MemoryConsumer } from '@/lib/engines/revision-engine';
import { ConceptExpansionConsumer } from '@/lib/engines/concept-expansion-engine';
import { processChatSideEffects, type ChatSideEffectsInput } from '@/lib/ai/chat-side-effects';
import { runAgenticConsumer } from '@/lib/agents/event-runner';

const MAX_RETRIES = 2; // Equivalent to retry_count < 3

type ConsumerResultStatus = 'HANDLED' | 'SKIPPED_INTENTIONALLY';

type ConsumerResult = {
  status: ConsumerResultStatus;
  reason?: string;
};

export class EventWorkerService {
  /**
   * Processes a batch of events by acquiring a lease and routing to the respective consumer.
   */
  static async processBatch(limit: number = 50, leaseTimeoutMinutes: number = 5) {
    const supabase = createAdminClient();
    const workerId = crypto.randomUUID();

    // 1. Acquire Leases
    const { data: leases, error: leaseErr } = await supabase.rpc('acquire_event_leases', {
      p_worker_id: workerId,
      p_limit: limit,
      p_lease_timeout: `${leaseTimeoutMinutes} minutes`,
    });

    if (leaseErr) {
      logger.error('Failed to acquire event leases', { error: leaseErr });
      throw leaseErr;
    }

    if (!leases || leases.length === 0) {
      return 0; // No events to process
    }
    logger.info('Event worker leases acquired', {
      workerId,
      feature: 'event-worker',
      leaseCount: leases.length,
    });

    // 2. Process events concurrently with Promise.allSettled for isolation
    await Promise.allSettled(
      leases.map(async (lease: any) => {
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

        // Record attempt start
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

        try {
          let result: ConsumerResult = { status: 'HANDLED' };
          await withCorrelationId(traceId, async () => {
            result = await runAgenticConsumer(lease, () => this.routeToConsumer(lease));
          });

          Metrics.eventConsumer(lease.consumer_name, lease.event_type, Date.now() - start, true);

          // Mark lock as completed
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

          // Check parent completion
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

        } catch (err: any) {
          Metrics.eventConsumer(lease.consumer_name, lease.event_type, Date.now() - start, false);
          const errorMsg = err instanceof Error ? err.message : String(err);
          
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

          await this.handleConsumerFailure(lease, errorMsg);
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
        }
      })
    );

    return leases.length;
  }

  private static async handleConsumerFailure(lease: any, errorMsg: string) {
    const supabase = createAdminClient();
    const newRetryCount = lease.retry_count + 1;
    const nextAttemptAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 10_000).toISOString();

    if (newRetryCount > MAX_RETRIES) {
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

      // Update lock to DLQ
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
    assertEventConsumerRoute(lease.event_type, lease.consumer_name);

    const event = {
      user_id: lease.user_id,
      type: lease.event_type,
      data: lease.event_payload,
      metadata: lease.event_metadata,
    };
    const payload = {
      ...(event.metadata ?? {}),
      ...(event.data ?? {}),
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
        const legacyType = this.mapToLegacyType(event.type);
        if (legacyType) {
          await LearningStateEngine.processLegacyEvent({
            userId: event.user_id,
            type: legacyType as any,
            data: payload,
          });
          return { status: 'HANDLED' };
        } else if (event.type === 'PRACTICE_ATTEMPT_RECORDED') {
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
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, payload);
          return { status: 'HANDLED' };
        } else if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'MIND_TUTOR_COMPLETED') {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, event.data);
          return { status: 'HANDLED' };
        } else if (event.type === 'MEMORY_CARD_REVIEWED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Card review updates ATLAS through mastery evidence writer' };
        } else if (event.type === 'PRACTICE_ATTEMPT_RECORDED') {
          await AtlasConsumer.handlePracticeAttempt(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        break;
      case 'memory_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, payload);
          return { status: 'HANDLED' };
        } else if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'MIND_TUTOR_COMPLETED') {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, event.data);
          return { status: 'HANDLED' };
        } else if (event.type === 'PRACTICE_ATTEMPT_RECORDED') {
          await MemoryConsumer.handlePracticeAttempt(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        break;
      case 'command_engine':
        if (event.type === 'STUDENT_MODEL_SYNC_REQUESTED') {
          if (payload.reason !== 'daily_synthesis') {
            return { status: 'SKIPPED_INTENTIONALLY', reason: 'COMMAND only handles daily synthesis sync requests' };
          }
          const { runDailySynthesisForUser } = await import('@/lib/services/command-plan.service');
          await runDailySynthesisForUser({
            userId: event.user_id,
            date: payload.date || new Date().toISOString().slice(0, 10),
            client: createAdminClient(),
          });
          return { status: 'HANDLED' };
        }
        break;
      case 'autopsy_engine':
        if (event.type === 'AUTOPSY_UPLOAD_RECEIVED') {
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
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, {
            ...payload,
            wrongQuestions: payload.wrongQuestions ?? [payload.mistake ?? payload],
          });
          return { status: 'HANDLED' };
        }
        if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'SESSION_CARD_COMPLETED') {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        if (event.type === 'REVISION_CARD_REVIEWED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Revision review is handled by MEMORY_CARD_REVIEWED projection' };
        }
        if (event.type === 'MATERIAL_INGESTED' || event.type === 'ATLAS_MASTERY_UPDATE_REQUESTED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'ATLAS agent wrapper registered; concrete handler is pending product-specific evidence mapping' };
        }
        break;
      case 'memory_agent':
        if (event.type === 'AUTOPSY_MISTAKE_APPROVED') {
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, {
            ...payload,
            wrongQuestions: payload.wrongQuestions ?? [payload.mistake ?? payload],
          });
          return { status: 'HANDLED' };
        }
        if (event.type === 'STUDY_SESSION_COMPLETED' || event.type === 'SESSION_CARD_COMPLETED') {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, payload);
          return { status: 'HANDLED' };
        }
        if (event.type === 'RAG_CARD_CANDIDATE_CREATED' || event.type === 'MEMORY_CARD_CREATE_REQUESTED' || event.type === 'MATERIAL_INGESTED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'MEMORY agent wrapper registered; card extraction requires explicit source payload' };
        }
        break;
      case 'planner_agent':
        if ([
          'MATERIAL_INGESTED',
          'AUTOPSY_PROCESSING_COMPLETED',
          'AUTOPSY_MISTAKE_APPROVED',
          'REVISION_CARD_REVIEWED',
          'LEARNER_STATE_CHANGED',
          'SESSION_RECOMMENDATION_REQUESTED',
          'PLANNER_REPLAN_REQUESTED',
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
          'AUTOPSY_MISTAKE_EXTRACTED',
          'AUTOPSY_MISTAKE_REJECTED',
        ].includes(event.type)) {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'AUTOPSY agent event acknowledged; state mutation happens only on approval' };
        }
        break;
      case 'command_agent':
        if (event.type === 'PLANNER_REPLAN_REQUESTED') {
          const { runDailySynthesisForUser } = await import('@/lib/services/command-plan.service');
          await runDailySynthesisForUser({
            userId: event.user_id,
            date: payload.date || new Date().toISOString().slice(0, 10),
            client: createAdminClient(),
          });
          return { status: 'HANDLED' };
        }
        break;
    }

    throw new Error(`Event routing error: ${consumer} has no handler for ${event.type}`);
  }

  private static async handleRagIngestionRequested(userId: string, payload: Record<string, any>): Promise<ConsumerResult> {
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
