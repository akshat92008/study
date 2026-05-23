// lib/workers/eventWorker.ts


import { trace } from '@/telemetry/otel';
import { CognitionEventType } from '@/lib/events/types';
import { sendSlackAlert } from '@/alerts/slackAlert';
import { propagateMastery } from '@/engines/masteryPropagation';
import { RedisQueue } from '@/queues/redisQueue';
import { eventProcessedCounter, eventProcessingLatency } from '@/telemetry/metrics';

/**
 * EventWorker processes cognition events using a durable RedisQueue.
 * It delegates handling to a simple switch based on `CognitionEventType`.
 */
export class EventWorker {
  private readonly queue: RedisQueue;

  constructor() {
    this.queue = new RedisQueue('cognition.events');
    // Consumer group is created inside RedisQueue constructor.
  }

  /** Start processing events via the RedisQueue. */
  public async start(): Promise<void> {
    const handler = async (payload: any) => {
      const span = trace.startSpan('eventWorker.handle');
      const start = Date.now();
      try {
        const { type, data, userId } = payload;
        switch (type) {
          case CognitionEventType.RetrievalSucceeded:
          case CognitionEventType.RetrievalFailed:
            console.log(`Processing ${type} for user ${userId}`);
            break;
          case CognitionEventType.MasteryChanged:
            await propagateMastery(userId, data.conceptId, data.newScore);
            console.log(`Mastery propagated for concept ${data.conceptId}`);
            break;
          default:
            console.warn(`Unhandled event type: ${type}`);
        }
        // Record metric for processed event
        eventProcessedCounter.add(1, { userId, eventType: type });
      } catch (innerErr) {
        span.recordException(innerErr);
        throw innerErr;
      } finally {
        const duration = Date.now() - start;
        eventProcessingLatency.record(duration, {});
        span.end();
      }
    };
    try {
      await this.queue.process(handler);
    } catch (err) {
      await sendSlackAlert('EventWorker crashed', (err as Error).message);
      const span = trace.startSpan('worker.start');
      span.recordException(err);
      span.end();
      throw err;
    }
  }
}

// Run the worker if this module is executed directly.
if (require.main === module) {
  const worker = new EventWorker();
  worker.start().catch((e) => {
    console.error('Worker terminated with error', e);
    process.exit(1);
  });
}
