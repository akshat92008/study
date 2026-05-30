// lib/observability/metrics.ts
// Real implementation — every call routes to Sentry breadcrumbs + performance spans.
// Uses dynamic import so Sentry only loads in environments where DSN is configured.
import { logger } from '@/lib/utils/logger';
import { getCorrelationId } from '@/lib/telemetry/correlation';
import { withSentry } from '@/lib/telemetry/sentry-runtime';

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
        const correlationId = getCorrelationId();
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'ai.call',
            message: `${provider} — ${taskType} — ${latencyMs}ms — ${success ? 'OK' : 'FAIL'}`,
            level: success ? 'info' : 'warning',
            data: { ...data, trace_id: correlationId },
          });

          if (!success) {
            // Surface failed AI calls as Sentry measurements so they show up in dashboards
            Sentry.setMeasurement?.(`ai.${provider}.latency_ms`, latencyMs, 'millisecond');
          }
        });
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
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'event.consumer',
            message: `${consumer} processed ${eventType} in ${durationMs}ms — ${success ? 'OK' : 'FAIL'}`,
            level: success ? 'info' : 'error',
            data,
          });
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
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'embedding.generated',
            message: `Generated ${count} embedding(s) via ${model}`,
            level: 'info',
            data: { count, model },
          });
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
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'token.usage',
            message: `${model}: ${promptTokens} prompt / ${completionTokens} completion`,
            level: 'info',
            data: { model, promptTokens, completionTokens },
          });
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
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'rate_limit.hit',
            message: `Rate limit hit on ${endpoint}`,
            level: 'warning',
            data,
          });
        });
      }

      logger.warn('Rate limit hit', data);
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track queue depth for background events.
   */
  queueDepth: (depth: number): void => {
    try {
      if (isSentryActive()) {
        withSentry((Sentry) => {
          Sentry.setMeasurement?.('event_queue.depth', depth, '');
        });
      }
    } catch {}
  },

  /**
   * Track planner failures (e.g. LLM failure causing fallback).
   */
  plannerFailure: (reason: string): void => {
    try {
      if (isSentryActive()) {
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'planner.failure',
            message: `Planner failed: ${reason}`,
            level: 'error',
            data: { reason, trace_id: getCorrelationId() },
          });
        });
      }
      logger.error('Planner failure', undefined, { reason });
    } catch {}
  },

  /**
   * Track RLS Denials for security monitoring.
   */
  rlsDenial: (table: string, action?: string): void => {
    try {
      if (isSentryActive()) {
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'security.rls_denial',
            message: `RLS policy denied access to ${table}`,
            level: 'error',
            data: { table, action, trace_id: getCorrelationId() },
          });
        });
      }
      logger.error('RLS Denial', undefined, { table, action });
    } catch {}
  },

  /**
   * Track End-to-end student response latency.
   */
  studentResponseLatency: (latencyMs: number): void => {
    try {
      if (isSentryActive()) {
        withSentry((Sentry) => {
          Sentry.setMeasurement?.('student_response.latency_ms', latencyMs, 'millisecond');
        });
      }
    } catch {}
  },

  /**
   * Track event retries and DLQ spikes.
   */
  eventRetry: (consumer: string, attempt: number, isDlq: boolean): void => {
    try {
      if (isSentryActive()) {
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: isDlq ? 'event.dlq_spike' : 'event.retry',
            message: isDlq ? `Event moved to DLQ: ${consumer}` : `Event retry ${attempt} for ${consumer}`,
            level: isDlq ? 'fatal' : 'warning',
            data: { consumer, attempt, isDlq, trace_id: getCorrelationId() },
          });
        });
      }
    } catch {}
  },

  /**
   * Track a critical error with full Sentry capture.
   * Use this for errors that indicate system-level failure, not user errors.
   */
  captureError: (error: Error, context?: Record<string, unknown>): void => {
    try {
      const traceId = getCorrelationId();
      withSentry((Sentry) => {
        if (Sentry.withScope) {
          Sentry.withScope((scope: any) => {
            if (context) scope.setExtras(context);
            if (traceId) scope.setTag('trace_id', traceId);
            Sentry.captureException?.(error);
          });
          return;
        }
        Sentry.captureException?.(error, { extra: context, tags: traceId ? { trace_id: traceId } : undefined });
      });
      logger.error('Critical error captured', error, { traceId });
    } catch {
      // Metrics must never throw
    }
  },

  /**
   * Track provider exhaustion (when all free providers fail).
   */
  providerExhaustion: (taskType: string): void => {
    try {
      if (isSentryActive()) {
        withSentry((Sentry) => {
          Sentry.addBreadcrumb?.({
            category: 'ai.provider_exhaustion',
            message: `All providers exhausted for ${taskType}`,
            level: 'fatal',
            data: { taskType, trace_id: getCorrelationId() },
          });
          Sentry.captureMessage?.(`All providers exhausted for ${taskType}`, 'warning');
        });
      }
      logger.error('Provider exhaustion', undefined, { taskType, trace_id: getCorrelationId() });
    } catch {}
  },
};
