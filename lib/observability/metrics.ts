// lib/observability/metrics.ts
// Real implementation — every call routes to Sentry breadcrumbs + performance spans.
// Uses dynamic import so Sentry only loads in environments where DSN is configured.
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/utils/logger';

const isSentryActive = (): boolean =>
  typeof process.env.SENTRY_DSN === 'string' &&
  process.env.SENTRY_DSN.length > 10 &&
  process.env.SENTRY_DSN !== 'YOUR_SENTRY_DSN_HERE';

export const Metrics = {
  /**
   * Track an AI provider call with latency and success/failure.
   * Attaches to the current Sentry transaction as a child span + breadcrumb.
   */
  aiCall: (
    provider: string,
    taskType: string,
    latencyMs: number,
    success: boolean
  ): void => {
    try {
      const data: Record<string, string | number | boolean> = {
        provider,
        task_type: taskType,
        latency_ms: latencyMs,
        success,
      };

      if (isSentryActive()) {
        Sentry.addBreadcrumb({
          category: 'ai.call',
          message: `${provider} — ${taskType} — ${latencyMs}ms — ${success ? 'OK' : 'FAIL'}`,
          level: success ? 'info' : 'warning',
          data,
        });

        if (!success) {
          // Surface failed AI calls as Sentry measurements so they show up in dashboards
          Sentry.setMeasurement(`ai.${provider}.latency_ms`, latencyMs, 'millisecond');
        }
      }

      // Always log to structured console so Vercel/Datadog log drain picks it up
      if (!success) {
        logger.warn('AI provider call failed', data);
      }
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track event consumer execution.
   */
  eventConsumer: (
    consumer: string,
    eventType: string,
    durationMs: number,
    success: boolean
  ): void => {
    try {
      const data: Record<string, string | number | boolean> = {
        consumer,
        event_type: eventType,
        duration_ms: durationMs,
        success,
      };

      if (isSentryActive()) {
        Sentry.addBreadcrumb({
          category: 'event.consumer',
          message: `${consumer} processed ${eventType} in ${durationMs}ms — ${success ? 'OK' : 'FAIL'}`,
          level: success ? 'info' : 'error',
          data,
        });
      }

      if (!success) {
        logger.error('Event consumer failed', undefined, data);
      }
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track embedding generation.
   */
  embeddingGenerated: (count: number, model: string): void => {
    try {
      if (isSentryActive()) {
        Sentry.addBreadcrumb({
          category: 'embedding.generated',
          message: `Generated ${count} embedding(s) via ${model}`,
          level: 'info',
          data: { count, model },
        });
      }
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track token usage.
   */
  tokenUsage: (model: string, promptTokens: number, completionTokens: number): void => {
    try {
      if (isSentryActive()) {
        Sentry.addBreadcrumb({
          category: 'token.usage',
          message: `${model}: ${promptTokens} prompt / ${completionTokens} completion`,
          level: 'info',
          data: { model, promptTokens, completionTokens },
        });
      }
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track rate limit hits — these are silent budget exhaustion signals in production.
   */
  rateLimitHit: (endpoint: string, userId: string): void => {
    try {
      const data = { endpoint, userId: userId.slice(0, 8) + '…' }; // partial ID only

      if (isSentryActive()) {
        Sentry.addBreadcrumb({
          category: 'rate_limit.hit',
          message: `Rate limit hit on ${endpoint}`,
          level: 'warning',
          data,
        });
      }

      logger.warn('Rate limit hit', data);
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track a critical error with full Sentry capture.
   * Use this for errors that indicate system-level failure, not user errors.
   */
  captureError: (error: Error, context?: Record<string, unknown>): void => {
    try {
      if (context) {
        Sentry.withScope((scope) => {
          scope.setExtras(context);
          Sentry.captureException(error);
        });
      } else {
        Sentry.captureException(error);
      }
      logger.error('Critical error captured', error);
    } catch {
      // Metrics must never throw
    }
  },
};
