import { createAdminClient } from '@/lib/supabase/admin';
import { withCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { Metrics } from '@/lib/observability/metrics';
import { assertEventConsumerRoute, EventConsumer } from './orchestrator';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { AtlasConsumer } from '@/lib/engines/cognition-graph';
import { MemoryConsumer } from '@/lib/engines/revision-engine';
import { CommandConsumer } from '@/lib/engines/command-engine';
import { ConceptExpansionConsumer } from '@/lib/engines/concept-expansion-engine';
import { processChatSideEffects } from '@/lib/ai/chat-side-effects';

const MAX_RETRIES = 5;

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

    // 2. Process events concurrently with Promise.allSettled for isolation
    await Promise.allSettled(
      leases.map(async (lease: any) => {
        const start = Date.now();
        const traceId = lease.event_metadata?.trace_id || lease.event_id;

        // Record attempt start
        const { data: attempt } = await supabase
          .from('event_attempts')
          .insert({
            consumer_lock_id: lease.lock_id,
            worker_id: workerId,
            started_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        try {
          let result: ConsumerResult = { status: 'HANDLED' };
          await withCorrelationId(traceId, async () => {
            result = await this.routeToConsumer(lease);
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
        }
      })
    );

    return leases.length;
  }

  private static async handleConsumerFailure(lease: any, errorMsg: string) {
    const supabase = createAdminClient();
    const newRetryCount = lease.retry_count + 1;
    const nextAttemptAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 10_000).toISOString();

    await supabase
      .from('event_queue')
      .update({
        retry_count: newRetryCount,
        next_attempt_at: nextAttemptAt,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lease.event_id);

    if (newRetryCount > MAX_RETRIES) {
      // Move to DLQ
      await supabase.from('event_dlq').insert({
        event_id: lease.event_id,
        user_id: lease.user_id,
        consumer_name: lease.consumer_name,
        event_type: lease.event_type,
        payload: lease.event_payload,
        event_metadata: lease.event_metadata,
        last_error: errorMsg,
      });
      
      Metrics.eventRetry(lease.consumer_name, newRetryCount, true);

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
    }
  }

  private static async checkParentEventCompletion(eventId: string) {
    const supabase = createAdminClient();
    
    // If all locks for this event are COMPLETED, DLQ, or FAILED, we mark parent accordingly.
    const { data: locks } = await supabase
      .from('consumer_locks')
      .select('status')
      .eq('event_id', eventId);

    if (locks && locks.length > 0) {
      const allCompleted = locks.every(l => l.status === 'COMPLETED');
      const anyFailed = locks.some(l => l.status === 'DLQ' || l.status === 'FAILED');

      if (allCompleted) {
        await supabase
          .from('event_queue')
          .update({
            status: 'COMPLETED',
            locked_at: null,
            locked_by: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', eventId);
      } else if (anyFailed && !locks.some(l => l.status === 'PENDING' || l.status === 'PROCESSING' || l.status === 'RETRY_SCHEDULED')) {
        await supabase
          .from('event_queue')
          .update({
            status: 'FAILED',
            locked_at: null,
            locked_by: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', eventId);
      }
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
        const legacyType = this.mapToLegacyType(event.type);
        if (legacyType) {
          await LearningStateEngine.processLegacyEvent({
            userId: event.user_id,
            type: legacyType as any,
            data: payload,
          });
          return { status: 'HANDLED' };
        }
        return { status: 'SKIPPED_INTENTIONALLY', reason: 'No learning-state projection for this event yet' };
      }
      case 'atlas_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, payload);
          return { status: 'HANDLED' };
        } else if (
          event.type === 'STUDY_SESSION_COMPLETED' ||
          event.type === 'MIND_TUTOR_COMPLETED' ||
          event.type === 'COMMAND_SESSION_COMPLETED'
        ) {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, event.data);
          return { status: 'HANDLED' };
        } else if (event.type === 'MEMORY_CARD_REVIEWED') {
          return { status: 'SKIPPED_INTENTIONALLY', reason: 'Card review updates ATLAS through mastery evidence writer' };
        }
        break;
      case 'memory_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, payload);
          return { status: 'HANDLED' };
        } else if (
          event.type === 'STUDY_SESSION_COMPLETED' ||
          event.type === 'MIND_TUTOR_COMPLETED' ||
          event.type === 'COMMAND_SESSION_COMPLETED'
        ) {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, event.data);
          return { status: 'HANDLED' };
        }
        break;
      case 'command_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await CommandConsumer.handleAutopsyProcessed(event.user_id, payload, payload);
          return { status: 'HANDLED' };
        } else if (
          event.type === 'STUDY_SESSION_COMPLETED' ||
          event.type === 'MIND_TUTOR_COMPLETED' ||
          event.type === 'COMMAND_SESSION_COMPLETED'
        ) {
          await CommandConsumer.handleStudySessionCompleted(event.user_id, event.data);
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
          // Initialize supabase locally in the worker to pass it down
          const { createAdminClient } = await import('@/lib/supabase/admin');
          await processChatSideEffects({
            supabase: createAdminClient(),
            ...payload
          });
          return { status: 'HANDLED' };
        }
        break;
    }

    throw new Error(`Event routing error: ${consumer} has no handler for ${event.type}`);
  }

  private static mapToLegacyType(type: string): string | null {
    switch (type) {
      case 'MIND_TUTOR_COMPLETED':
      case 'STUDY_SESSION_COMPLETED':
      case 'COMMAND_SESSION_COMPLETED':
        return 'SESSION_COMPLETED';
      case 'MEMORY_CARD_REVIEWED':
        return 'CARD_REVIEWED';
      case 'COMMAND_TASK_COMPLETED':
        return 'TASK_COMPLETED';
      default:
        return type;
    }
  }
}
