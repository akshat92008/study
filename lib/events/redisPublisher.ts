// lib/events/redisPublisher.ts

import redis from '@/events/redisClient';
import { sanitizeEventData } from '@/events/sanitizer';
import { CognitionEventType } from '@/events/types';

/**
 * Publish a sanitized event payload to the Cognition Redis stream.
 *
 * @param type   CognitionEventType enum value (or any string for custom events).
 * @param payload Arbitrary JSON payload that will be sanitized before sending.
 * @param idempotencyKey Optional key to guarantee exactly‑once processing.
 */
export async function publishToStream(
  type: CognitionEventType | string,
  payload: any,
  idempotencyKey?: string,
): Promise<void> {
  const key = idempotencyKey ?? `${Date.now()}-${Math.random()}`;
  const safePayload = sanitizeEventData(payload);
  const streamPayload = JSON.stringify({
    type,
    data: safePayload,
    idempotencyKey: key,
  });
  await redis.xadd('cognition.events', '*', {
    eventId: key,
    eventType: type,
    payload: streamPayload,
  });
}
