import { EventDispatcher } from './orchestrator';
import { logger } from '@/lib/utils/logger';
import { after } from 'next/server';

export async function safePublishEvent(input: Parameters<typeof EventDispatcher.publish>[0]): Promise<{ ok: boolean; eventId?: string; errorCode?: string; message?: string }> {
  try {
    const eventId = await EventDispatcher.publish(input);
    
    after(() => {
      // Opportunistically trigger the worker for this user
      // Avoid circular dependency by using fetch to internal route or dynamic import
      const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${host}/api/internal/workers/process-events`, {
        method: 'POST',
        headers: { 'x-internal-worker-secret': process.env.INTERNAL_WORKER_SECRET || '' }
      }).catch(err => {
        logger.warn('Failed to opportunistically trigger event worker', { error: String(err) });
      });
    });

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
