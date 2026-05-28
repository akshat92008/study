// lib/observability/metrics.ts
import * as Sentry from '@sentry/nextjs';

type MetricTags = Record<string, string | number | boolean>;

export const Metrics = {
  // AI provider performance
  aiCall: (provider: string, taskType: string, latencyMs: number, success: boolean) => {
    if (!Sentry.metrics) return;
    Sentry.metrics.distribution('ai.latency_ms', latencyMs, {
      tags: { provider, task_type: taskType, success: String(success) },
    });
    Sentry.metrics.increment('ai.calls', 1, {
      tags: { provider, task_type: taskType, success: String(success) },
    });
  },
  
  // Event consumer
  eventConsumer: (consumer: string, eventType: string, durationMs: number, success: boolean) => {
    if (!Sentry.metrics) return;
    Sentry.metrics.distribution('event.consumer.duration_ms', durationMs, {
      tags: { consumer, event_type: eventType, success: String(success) },
    });
  },
  
  // Embedding
  embeddingGenerated: (count: number, model: string) => {
    if (!Sentry.metrics) return;
    Sentry.metrics.increment('embeddings.generated', count, { tags: { model } });
  },
  
  // Rate limiting
  rateLimitHit: (endpoint: string, userId: string) => {
    if (!Sentry.metrics) return;
    Sentry.metrics.increment('ratelimit.hit', 1, { tags: { endpoint } });
  },
};
