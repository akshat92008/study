//// lib/events/publisher.ts

import { db } from '@/lib/db';
import { studentEvents } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { trace } from '@/lib/telemetry/otel';
import redis from '@/lib/events/redisClient';
import { sanitizeEventData } from '@/lib/events/sanitizer';
import { CognitionEventType } from '@/lib/events/types';

/**
 * Publish an event to the central event bus.
 * Stores the event in Postgres for persistence and pushes a sanitized payload to a Redis stream.
 * The stream enables durable, replayable orchestration for learners.
 *
 * @param userId   UUID of the learner.
 * @param type     Event type string (e.g., "conversation.completed").
 * @param data     Arbitrary JSON payload describing the event.
 * @param idempotencyKey Optional key to guarantee exactly‑once processing.
 */
export async function publishEvent(
  userId: string,
  type: string,
  data: any,
  idempotencyKey?: string,
): Promise<void> {
  const span = trace.startSpan('event.publish', {
    attributes: {
      userId,
      type,
      idempotencyKey: idempotencyKey ?? '',
    },
  });
  try {
    const key = idempotencyKey ?? randomUUID();
    // Sanitize data before exposing it externally.
    const safeData = sanitizeEventData(data);

    // Insert event row for historical audit.
    await db
      .insert(studentEvents)
      .values({
        userId,
        type,
        data: {
          ...safeData,
          idempotencyKey: key,
        },
      });

    // Publish to Redis stream – consumer groups will handle processing.
    // Use the CognitionEventType enum when possible for downstream typing.
    const streamPayload = JSON.stringify({
      userId,
      type,
      data: safeData,
      idempotencyKey: key,
    });
    await redis.xadd('cognition.events', '*', {
      eventId: key,
      eventType: type,
      payload: streamPayload,
    });

    span.setAttribute('event.idempotencyKey', key);
    span.setAttribute('event.stream', 'cognition.events');
  } finally {
    span.end();
  }
}
