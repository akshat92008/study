import { EventDispatcher } from './orchestrator';
import { logger } from '@/lib/utils/logger';

export async function safePublishEvent(input: Parameters<typeof EventDispatcher.publish>[0]): Promise<{ ok: boolean; eventId?: string; errorCode?: string; message?: string }> {
  try {
    const eventId = await EventDispatcher.publish(input);
    return { ok: true, eventId };
  } catch (error: any) {
    logger.error('Safe publish event failed', error, {
      userId: input.userId ?? input.user_id,
      type: input.type,
      feature: 'event-enqueue',
      idempotencyKey: input.idempotencyKey ?? input.idempotency_key,
    });
    return {
      ok: false,
      errorCode: error.code || 'PUBLISH_FAILED',
      message: error.message || 'Failed to publish event',
    };
  }
}
