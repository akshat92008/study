// lib/observability/metrics.ts
import * as Sentry from '@sentry/nextjs';

type MetricTags = Record<string, string | number | boolean>;

export const Metrics = {
  // AI provider performance
  aiCall: (provider: string, taskType: string, latencyMs: number, success: boolean) => {},
  
  // Event consumer
  eventConsumer: (consumer: string, eventType: string, durationMs: number, success: boolean) => {},
  
  // Embedding
  embeddingGenerated: (count: number, model: string) => {},
  
  // Rate limiting
  rateLimitHit: (endpoint: string, userId: string) => {},
};
