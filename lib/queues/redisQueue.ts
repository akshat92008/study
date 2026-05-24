export interface QueueMessage {
  payload: any;
}

export class RedisQueue {
  private readonly stream: string;
  private readonly maxRetries: number;
  private queue: Array<{ id: string; payload: any; attempts: number }> = [];
  private processing = false;

  constructor(
    stream: string,
    options?: {
      dlq?: string;
      retryStream?: string;
      group?: string;
      consumer?: string;
      maxRetries?: number;
      baseDelayMs?: number;
    }
  ) {
    this.stream = stream;
    this.maxRetries = options?.maxRetries ?? 5;
    console.log(`[Queue] In-memory queue initialised for stream: ${stream}`);
  }

  async enqueue(payload: any): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.queue.push({ id, payload, attempts: 0 });
    console.log(`[Queue] Enqueued message ${id} on stream: ${this.stream}`);
    return id;
  }

  async process(handler: (payload: any) => Promise<void>): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (true) {
      if (this.queue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      const message = this.queue.shift();
      if (!message) continue;

      try {
        await handler(message.payload);
        console.log(`[Queue] Processed message ${message.id}`);
      } catch (err) {
        message.attempts += 1;
        if (message.attempts < this.maxRetries) {
          const delay = 1000 * Math.pow(2, message.attempts - 1);
          console.warn(`[Queue] Message ${message.id} failed (attempt ${message.attempts}), retrying in ${delay}ms`);
          setTimeout(() => this.queue.push(message), delay);
        } else {
          console.error(`[Queue] Message ${message.id} exceeded max retries. Dropping.`, err);
        }
      }
    }
  }
}