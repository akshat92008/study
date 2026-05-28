import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

export interface QueueMessage {
  payload: any;
}

// Ensure you have REDIS_URL in your environment variables for production
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export class RedisQueue {
  private readonly stream: string;
  private readonly maxRetries: number;
  private queue: Queue;
  private worker?: Worker;

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
    
    this.queue = new Queue(this.stream, {
      connection,
      defaultJobOptions: {
        attempts: this.maxRetries,
        backoff: {
          type: 'exponential',
          delay: options?.baseDelayMs ?? 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
    console.log(`[Queue] BullMQ queue initialized for stream: ${stream}`);
  }

  async enqueue(payload: any): Promise<string> {
    const job = await this.queue.add('default', payload);
    console.log(`[Queue] Enqueued message ${job.id} on stream: ${this.stream}`);
    return job.id || '';
  }

  async process(handler: (payload: any) => Promise<void>): Promise<void> {
    if (this.worker) return;

    this.worker = new Worker(
      this.stream,
      async (job: Job) => {
        await handler(job.data);
      },
      { connection }
    );

    this.worker.on('completed', (job) => {
      console.log(`[Queue] Processed message ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      console.warn(`[Queue] Message ${job?.id} failed:`, err);
    });
  }
}