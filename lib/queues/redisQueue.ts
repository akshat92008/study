// lib/queues/redisQueue.ts

/**
 * A lightweight durable queue built on top of Redis Streams.
 *
 * Features:
 *  - Enqueue arbitrary payloads.
 *  - Consumer‑group processing with automatic acknowledgment.
 *  - Retry with exponential back‑off (configurable).
 *  - Dead‑letter queue (DLQ) after exceeding max retries.
 *  - Optional delayed‑retry handling via a companion "retry" stream.
 */
import redis from '@/events/redisClient';
import { sendSlackAlert } from '@/alerts/slackAlert';

export interface QueueMessage {
  payload: any;
}

export class RedisQueue {
  private readonly stream: string;
  private readonly dlq: string;
  private readonly retryStream: string;
  private readonly group: string;
  private readonly consumer: string;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(stream: string, options?: { dlq?: string; retryStream?: string; group?: string; consumer?: string; maxRetries?: number; baseDelayMs?: number }) {
    this.stream = stream;
    this.dlq = options?.dlq ?? `${stream}.dlq`;
    this.retryStream = options?.retryStream ?? `${stream}.retry`;
    this.group = options?.group ?? 'cognition-group';
    this.consumer = options?.consumer ?? `worker-${Math.random().toString(36).substring(2, 8)}`;
    this.maxRetries = options?.maxRetries ?? 5;
    this.baseDelayMs = options?.baseDelayMs ?? 1000; // 1 s base
    this.ensureGroup().catch((e) => console.error('Queue init error', e));
    this.ensureRetryStream().catch((e) => console.error('Retry stream init error', e));
  }

  /** Ensure the consumer group exists – idempotent. */
  private async ensureGroup(): Promise<void> {
    try {
      await redis.xgroup('CREATE', this.stream, this.group, '0', 'MKSTREAM');
    } catch (e: any) {
      if (!e.message?.includes('BUSYGROUP')) {
        throw e;
      }
    }
  }

  /** Ensure a separate stream for delayed retries exists. */
  private async ensureRetryStream(): Promise<void> {
    // XGROUP CREATE works on any stream name; use same group name.
    try {
      await redis.xgroup('CREATE', this.retryStream, this.group, '0', 'MKSTREAM');
    } catch (e: any) {
      if (!e.message?.includes('BUSYGROUP')) {
        throw e;
      }
    }
  }

  /** Enqueue a payload onto the main stream. */
  async enqueue(payload: any): Promise<string> {
    const id = await redis.xadd(this.stream, '*', { payload: JSON.stringify(payload) });
    return id;
  }

  /** Process messages using the supplied handler.
   *  The method runs an infinite loop – it should be invoked in a background task.
   */
  async process(handler: (payload: any) => Promise<void>): Promise<void> {
    // First, drain any delayed messages that are now eligible.
    await this.moveReadyDelayedMessages();

    while (true) {
      const records = await redis.xreadgroup(
        'GROUP',
        this.group,
        this.consumer,
        'COUNT', 10,
        'BLOCK', 2000,
        'STREAMS',
        this.stream,
        '>'
      );
      if (!records) {
        // No immediate work – still check delayed stream periodically.
        await this.moveReadyDelayedMessages();
        continue;
      }
      for (const [, entries] of records) {
        for (const [id, fields] of entries) {
          await this.handleEntry(id, fields, handler);
        }
      }
    }
  }

  /** Move eligible delayed messages back to the main stream. */
  private async moveReadyDelayedMessages(): Promise<void> {
    const now = Date.now().toString();
    const pending = await redis.xreadgroup(
      'GROUP', this.group, this.consumer,
      'COUNT', 10,
      'STREAMS', this.retryStream,
      now
    );
    if (!pending) return;
    for (const [, entries] of pending) {
      for (const [id, fields] of entries) {
        const retryAt = Number(fields.retryAt as string);
        if (retryAt <= Date.now()) {
          // Re‑emit onto the main stream with same payload.
          await redis.xadd(this.stream, '*', { payload: fields.payload });
          await redis.xack(this.retryStream, this.group, id);
        }
      }
    }
  }

  /** Core entry handling with retry / DLQ logic. */
  private async handleEntry(id: string, fields: any, handler: (payload: any) => Promise<void>): Promise<void> {
    try {
      const payload = JSON.parse(fields.payload as string);
      await handler(payload);
      await redis.xack(this.stream, this.group, id);
      await redis.del(`retry:${id}`);
    } catch (err) {
      const retryKey = `retry:${id}`;
      const attempts = (await redis.hincrby(retryKey, 'count', 1)) as number;
      if (attempts > this.maxRetries) {
        // Move to DLQ.
        await redis.xadd(this.dlq, '*', { originalId: id, payload: fields.payload });
        await redis.xack(this.stream, this.group, id);
        await sendSlackAlert('Queue message moved to DLQ', `Message ${id} exceeded ${this.maxRetries} retries`);
      } else {
        // Schedule delayed retry using exponential back‑off.
        const delay = this.baseDelayMs * Math.pow(2, attempts - 1);
        const retryAt = Date.now() + delay;
        await redis.xadd(this.retryStream, '*', { originalId: id, payload: fields.payload, retryAt: retryAt.toString() });
        // Do NOT ack the original message; it stays pending and will be reclaimed after the consumer crashes.
        // Optional: you can also XDEL the original id to avoid duplicate processing.
        await redis.xdel(this.stream, id);
      }
    }
  }
}
