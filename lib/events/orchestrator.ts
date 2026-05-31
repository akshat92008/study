// lib/events/orchestrator.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { getCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { validateEventEnvelope } from './schema';
export const EVENT_CONSUMERS = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'command_engine',
  'concept_expansion_engine',
  'chat_side_effect_engine',
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

export const EVENT_CONSUMER_MATRIX = {
  CHAT_MESSAGE_PROCESSED: ['chat_side_effect_engine'],
  AUTOPSY_MOCK_PROCESSED: [
    'atlas_engine',
    'memory_engine',
    'command_engine',
    'learning_state_engine',
  ],
  COMMAND_SESSION_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'command_engine',
    'learning_state_engine',
  ],
  STUDY_SESSION_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'command_engine',
    'learning_state_engine',
  ],
  MIND_TUTOR_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'command_engine',
    'learning_state_engine',
  ],
  MEMORY_CARD_REVIEWED: ['learning_state_engine', 'atlas_engine'],
  COMMAND_TASK_COMPLETED: ['learning_state_engine'],
  COMMAND_TASK_DELAYED: ['learning_state_engine'],
  ATLAS_MASTERY_UPDATED: ['learning_state_engine'],
  MEMORY_CARD_CREATED: ['learning_state_engine'],
  COMMAND_SESSION_CREATED: ['learning_state_engine'],
  CONCEPT_DISCOVERED: ['concept_expansion_engine'],
  INGESTION_DOCUMENT_PROCESSED: ['learning_state_engine'],
  MIND_MESSAGE_CREATED: ['learning_state_engine'],
} as const satisfies Record<string, readonly EventConsumer[]>;

export type RoutedEventType = keyof typeof EVENT_CONSUMER_MATRIX;

export function getConsumersForEvent(type: string): readonly EventConsumer[] {
  return EVENT_CONSUMER_MATRIX[type as RoutedEventType] ?? [];
}

export function assertEventConsumerRoute(type: string, consumer: string): asserts consumer is EventConsumer {
  const expected = getConsumersForEvent(type);
  if (!expected.includes(consumer as EventConsumer)) {
    throw new Error(`Event routing error: ${consumer} is not registered for ${type}`);
  }
}

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

    const consumers = getConsumersForEvent(input.type);
    if (consumers.length === 0) {
      throw new Error(`Unsupported event type: ${input.type}`);
    }

    const idempotencyKey = input.idempotencyKey ?? input.idempotency_key ?? crypto.randomUUID();
    const metadata = {
      ...(input.metadata ?? {}),
      source: input.source ?? input.metadata?.source ?? 'system_publish',
      trace_id: getCorrelationId() ?? crypto.randomUUID(),
    };

    validateEventEnvelope({
      user_id: userId,
      type: input.type,
      data: input.data ?? input.payload ?? {},
    });

    // Use the RPC to atomically insert into event_queue and create consumer_locks
    const { data: eventId, error } = await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: input.type,
      p_data: input.data ?? input.payload ?? {},
      p_idempotency_key: idempotencyKey,
      p_source: metadata.source,
      p_metadata: metadata,
    });

    if (error) {
      logger.error('Failed to publish event', error, {
        userId,
        type: input.type,
        feature: 'event-enqueue',
        traceId: metadata.trace_id,
      });
      throw error;
    }
    logger.info('Event enqueued', {
      userId,
      eventId,
      type: input.type,
      consumers,
      feature: 'event-enqueue',
      traceId: metadata.trace_id,
    });

    // Instead of after(), we just return. The external worker (or cron) 
    // hitting /api/internal/workers/process-events will pick this up.
    // However, to optimize latency, we could fire-and-forget a non-blocking fetch here
    // but the instruction was NO runtime consumer execution from API routes, they may ONLY enqueue.

    return eventId;
  }

  static async runAllConsumers(_eventId: string): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('runAllConsumers is test-only. Use /api/cron/process-events for runtime processing.');
    }

    const { EventWorkerService } = await import('@/lib/events/worker');
    await EventWorkerService.processBatch(EVENT_CONSUMERS.length, 5);
  }
}

export const EventOrchestrator = EventDispatcher;
