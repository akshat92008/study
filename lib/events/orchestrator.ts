// lib/events/orchestrator.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { withCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';
import { AtlasConsumer } from '@/lib/engines/cognition-graph';
import { MemoryConsumer } from '@/lib/engines/revision-engine';
import { CommandConsumer } from '@/lib/engines/command-engine';
import { ConceptExpansionConsumer } from '@/lib/engines/concept-expansion-engine';
import { after } from 'next/server';
import { Metrics } from '@/lib/observability/metrics';

// BullMQ/ioredis removed — incompatible with Vercel serverless (TCP Redis).
// Consumers are dispatched inline via after() — no worker process needed.

const MAX_RETRIES = 5;

export const EVENT_CONSUMERS = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'command_engine',
  'concept_expansion_engine',
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

type PublishInput = {
  userId?: string;
  user_id?: string;
  type: string;
  source?: string;
  data?: any;
  payload?: any;
  idempotencyKey?: string;
  idempotency_key?: string;
  metadata?: Record<string, any>;
};

export class EventDispatcher {
  static async publish(input: PublishInput): Promise<string> {
    const supabase = createAdminClient();

    const userId = input.userId ?? input.user_id;
    if (!userId) throw new Error('Event publish requires userId');

    const idempotencyKey = input.idempotencyKey ?? input.idempotency_key;
    const traceId = crypto.randomUUID();
    const metadata = {
      ...(input.metadata ?? {}),
      source: input.source ?? input.metadata?.source ?? 'system_publish',
    };

    const eventRow = {
      user_id: userId,
      type: input.type,
      data: input.data ?? input.payload ?? {},
      status: 'pending',
      retry_count: 0,
      idempotency_key: idempotencyKey,
      trace_id: traceId,
      version: 'v2',
      metadata,
    };

    const { data: insertedEvent, error } = await supabase
      .from('student_events')
      .insert(eventRow)
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505' && idempotencyKey) {
        const { data: existing } = await supabase
          .from('student_events')
          .select('id')
          .eq('user_id', userId)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (existing?.id) return existing.id;
        return 'idempotent_skip';
      }
      logger.error('Failed to publish event', { type: input.type, error });
      throw error;
    }

    const eventId = insertedEvent?.id ?? traceId;
    await this.registerConsumers(eventId);

    // Run consumers directly — caller is already inside after() context
    // Do not nest after() inside after()
    this.runAllConsumers(eventId).catch(err => {
      logger.error('Unhandled error in consumer dispatch', err);
    });

    return eventId;
  }

  static async runAllConsumers(eventId: string): Promise<void> {
    await Promise.allSettled(
      EVENT_CONSUMERS.map((consumer) => this.processConsumer(eventId, consumer))
    );
  }

  private static async registerConsumers(eventId: string): Promise<void> {
    const supabase = createAdminClient();
    const trackingRows = EVENT_CONSUMERS.map((consumer) => ({
      event_id: eventId,
      consumer_name: consumer,
      status: 'pending', // ← Start as pending, not processing (was a bug)
    }));

    const { error } = await supabase
      .from('event_consumer_tracking')
      .insert(trackingRows);

    if (error && error.code !== '23505') {
      logger.error('Failed to register event consumers', { eventId, error });
      throw error;
    }
  }

  static async processConsumer(eventId: string, consumer: EventConsumer): Promise<void> {
    const supabase = createAdminClient();

    const { data: tracking, error: lockErr } = await supabase
      .from('event_consumer_tracking')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('consumer_name', consumer)
      .in('status', ['pending', 'processing', 'failed'])
      .select('*')
      .single();

    if (lockErr || !tracking) return;

    const { data: event } = await supabase
      .from('student_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) return;

    const start = Date.now();
    try {
      await withCorrelationId(event.trace_id || event.id, async () => {
        await this.routeToConsumer(event, consumer);
      });

      Metrics.eventConsumer(consumer, event.type, Date.now() - start, true);
      await supabase
        .from('event_consumer_tracking')
        .update({
          status: 'completed',
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('consumer_name', consumer);

      await this.checkParentEventCompletion(eventId);
    } catch (err: any) {
      Metrics.eventConsumer(consumer, event.type, Date.now() - start, false);
      const errorMsg = err instanceof Error ? err.message : String(err);
      const retryCount = (tracking.retry_count || 0) + 1;

      if (retryCount > MAX_RETRIES) {
        await this.moveToDLQ(event, `Consumer ${consumer} failed: ${errorMsg}`);
        await supabase
          .from('event_consumer_tracking')
          .update({
            status: 'failed',
            retry_count: retryCount,
            last_error: 'Max retries exceeded',
            updated_at: new Date().toISOString(),
          })
          .eq('event_id', eventId)
          .eq('consumer_name', consumer);
        await supabase
          .from('student_events')
          .update({ status: 'failed', last_error: `Consumer ${consumer} failed` })
          .eq('id', eventId);
      } else {
        await supabase
          .from('event_consumer_tracking')
          .update({
            status: 'failed',
            retry_count: retryCount,
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('event_id', eventId)
          .eq('consumer_name', consumer);
      }
    }
  }

  private static async checkParentEventCompletion(eventId: string): Promise<void> {
    const supabase = createAdminClient();
    const { data: trackingRows } = await supabase
      .from('event_consumer_tracking')
      .select('status')
      .eq('event_id', eventId);

    if (trackingRows?.length && trackingRows.every((row: any) => row.status === 'completed')) {
      await supabase
        .from('student_events')
        .update({ status: 'completed', last_error: null })
        .eq('id', eventId);
    }
  }

  private static async routeToConsumer(event: any, consumer: EventConsumer): Promise<void> {
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
        }
        break;
      }
      case 'atlas_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await AtlasConsumer.handleAutopsyProcessed(event.user_id, payload);
        } else if (
          event.type === 'STUDY_SESSION_COMPLETED' ||
          event.type === 'MIND_TUTOR_COMPLETED' ||
          event.type === 'COMMAND_SESSION_COMPLETED'
        ) {
          await AtlasConsumer.handleStudySessionCompleted(event.user_id, event.data);
        }
        break;
      case 'memory_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await MemoryConsumer.handleAutopsyProcessed(event.user_id, payload);
        } else if (
          event.type === 'STUDY_SESSION_COMPLETED' ||
          event.type === 'MIND_TUTOR_COMPLETED' ||
          event.type === 'COMMAND_SESSION_COMPLETED'
        ) {
          await MemoryConsumer.handleStudySessionCompleted(event.user_id, event.data);
        }
        break;
      case 'command_engine':
        if (event.type === 'AUTOPSY_MOCK_PROCESSED') {
          await CommandConsumer.handleAutopsyProcessed(event.user_id, payload, payload);
        } else if (
          event.type === 'STUDY_SESSION_COMPLETED' ||
          event.type === 'MIND_TUTOR_COMPLETED' ||
          event.type === 'COMMAND_SESSION_COMPLETED'
        ) {
          await CommandConsumer.handleStudySessionCompleted(event.user_id, event.data);
        }
        break;
      case 'concept_expansion_engine':
        if (event.type === 'CONCEPT_DISCOVERED') {
          await ConceptExpansionConsumer.handleConceptDiscovered(event.user_id, payload);
        }
        break;
    }
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

  private static async moveToDLQ(event: any, errorMessage: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from('dlq_events').insert({
      event_id: event.id,
      user_id: event.user_id,
      trace_id: event.trace_id,
      version: event.version,
      type: event.type,
      data: event.data,
      metadata: event.metadata,
      error_message: errorMessage,
    });

    if (error) {
      logger.error('Failed to write event to DLQ', { eventId: event.id, error });
    }
  }
}

export const EventOrchestrator = EventDispatcher;
