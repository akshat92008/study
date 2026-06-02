// lib/events/orchestrator.ts
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCorrelationId } from '@/lib/telemetry/correlation';
import { logger } from '@/lib/utils/logger';
import { validateEventEnvelope } from './schema';
import { EVENT_CONSUMERS, getConsumersForEvent } from './routes';
export {
  EVENT_CONSUMERS,
  EVENT_CONSUMER_MATRIX,
  assertEventConsumerRoute,
  getConsumersForEvent,
  type EventConsumer,
  type RoutedEventType,
} from './routes';

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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function deterministicEventKey(input: {
  userId: string;
  type: string;
  source: string;
  data: unknown;
}) {
  const digest = createHash('sha256')
    .update(stableStringify({
      userId: input.userId,
      type: input.type,
      source: input.source,
      data: input.data ?? {},
    }))
    .digest('hex')
    .slice(0, 32);
  return `event:${input.type}:${digest}`;
}

export class EventDispatcher {
  static async publish(input: PublishInput): Promise<string> {
    const supabase = createAdminClient();

    const userId = input.userId ?? input.user_id;
    if (!userId) throw new Error('Event publish requires userId');

    const consumers = getConsumersForEvent(input.type);
    if (consumers.length === 0) {
      throw new Error(`Unsupported event type: ${input.type}`);
    }

    const data = input.data ?? input.payload ?? {};
    const source = input.source ?? input.metadata?.source ?? 'system_publish';
    const idempotencyKey = input.idempotencyKey ?? input.idempotency_key ?? deterministicEventKey({
      userId,
      type: input.type,
      source,
      data,
    });
    const metadata = {
      ...(input.metadata ?? {}),
      source,
      trace_id: getCorrelationId() ?? crypto.randomUUID(),
    };

    validateEventEnvelope({
      user_id: userId,
      type: input.type,
      data,
    });

    // Use the RPC to atomically insert into event_queue and create consumer_locks
    const { data: eventId, error } = await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: input.type,
      p_data: data,
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


}

export const EventOrchestrator = EventDispatcher;
