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

const NOISY_EVENT_TYPES = new Set([
  'SESSION_CARD_COMPLETED',
  'PLANNER_REPLAN_REQUESTED',
  'STUDENT_MODEL_SYNC_REQUESTED',
  'LEARNER_STATE_CHANGED',
  'MATERIAL_INGESTION_REQUESTED',
  'MATERIAL_UPLOADED',
  'CHAT_MESSAGE_PROCESSED',
  'CHAT_MESSAGE_CREATED',
]);

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
    const metadata: Record<string, any> = {
      ...(input.metadata ?? {}),
      source,
      trace_id: getCorrelationId() ?? crypto.randomUUID(),
    };
    const coalesceEntityId = getEventEntityId(data);
    if (NOISY_EVENT_TYPES.has(input.type) && coalesceEntityId) {
      metadata.coalesce_key = `${input.type}:${coalesceEntityId}:${source}`;
    }

    validateEventEnvelope({
      user_id: userId,
      type: input.type,
      data,
    });

    const pressureGuard = await enforceEventPressureGuards({
      supabase,
      userId,
      type: input.type,
      data,
      source,
      idempotencyKey,
    });
    if (pressureGuard.skip) {
      logger.warn('Event enqueue skipped by pressure guard', {
        userId,
        type: input.type,
        reason: pressureGuard.reason,
        existingEventId: pressureGuard.eventId,
        feature: 'event-enqueue',
        traceId: metadata.trace_id,
      });
      return pressureGuard.eventId ?? `event_skipped:${input.type}:${pressureGuard.reason}`;
    }

    const eventId = crypto.randomUUID();
    // Use the RPC to atomically insert into event_queue and create consumer_locks
    const { data: dbEventId, error } = await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: input.type,
      p_data: data,
      p_idempotency_key: idempotencyKey,
      p_source: metadata.source,
      p_metadata: metadata,
    });

    if (error) {
      logger.error('Failed to publish event to Postgres', error, {
        userId,
        type: input.type,
        feature: 'event-enqueue',
        traceId: metadata.trace_id,
      });
      throw error;
    }
    logger.info('Event enqueued to Postgres', {
      userId,
      eventId: dbEventId,
      type: input.type,
      consumers,
      feature: 'event-enqueue',
      traceId: metadata.trace_id,
    });

    // Instead of after(), we just return. The external worker (or cron) 
    // hitting /api/internal/workers/process-events will pick this up.
    // However, to optimize latency, we could fire-and-forget a non-blocking fetch here
    // but the instruction was NO runtime consumer execution from API routes, they may ONLY enqueue.

    return dbEventId;
  }


}

export const EventOrchestrator = EventDispatcher;

async function enforceEventPressureGuards(input: {
  supabase: any;
  userId: string;
  type: string;
  data: any;
  source: string;
  idempotencyKey: string;
}): Promise<{ skip: boolean; reason?: string; eventId?: string }> {
  if (typeof input.supabase?.from !== 'function') {
    return { skip: false };
  }

  const dailyLimit = boundedEnvInt('DAILY_USER_EVENT_LIMIT', 500, 1, 10_000);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count, error: countError } = await input.supabase
    .from('event_queue')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .gte('created_at', dayStart.toISOString());

  if (!countError && (count ?? 0) >= dailyLimit) {
    return { skip: true, reason: 'daily_user_event_cap' };
  }

  if (!NOISY_EVENT_TYPES.has(input.type)) {
    return { skip: false };
  }

  const entityId = getEventEntityId(input.data);
  if (!entityId) {
    return { skip: false };
  }

  const windowSeconds = boundedEnvInt('EVENT_COALESCE_WINDOW_SECONDS', 120, 5, 3600);
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const coalesceKey = `${input.type}:${entityId}:${input.source}`;

  const { data: existing, error } = await input.supabase
    .from('event_queue')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('type', input.type)
    .gte('created_at', windowStart)
    .contains('metadata', { coalesce_key: coalesceKey })
    .in('status', ['PENDING', 'PROCESSING'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!error && existing?.id) {
    return { skip: true, reason: 'coalesced', eventId: existing.id };
  }

  return { skip: false };
}

function getEventEntityId(data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  const candidate =
    data.entityId ??
    data.materialId ??
    data.material_id ??
    data.goalId ??
    data.goal_id ??
    data.sessionId ??
    data.session_id ??
    data.chatSessionId ??
    data.chat_session_id ??
    data.taskId ??
    data.task_id ??
    data.sourceEventId ??
    data.source_event_id;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function boundedEnvInt(key: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}
