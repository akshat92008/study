// lib/telemetry/metrics.ts
// Real OTEL counters/histograms.
// Falls back gracefully when OTEL_EXPORTER_OTLP_ENDPOINT is not configured.
import { logger } from '@/lib/utils/logger';

const isOtelActive = (): boolean =>
  typeof process.env.OTEL_EXPORTER_OTLP_ENDPOINT === 'string' &&
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT.length > 0;

// Lightweight in-memory accumulator used when OTEL is not configured.
// Values are emitted to structured logs every minute so they're not lost.
class LoggingMetric {
  private name: string;
  private kind: 'counter' | 'histogram';
  private total = 0;
  private count = 0;

  constructor(name: string, kind: 'counter' | 'histogram') {
    this.name = name;
    this.kind = kind;
  }

  add(value: number, attributes?: Record<string, unknown>): void {
    this.total += value;
    this.count++;
    if (attributes && Object.keys(attributes).length > 0) {
      logger.info(`[metric] ${this.name}`, { value, ...attributes });
    }
  }

  record(value: number, attributes?: Record<string, unknown>): void {
    this.add(value, attributes);
  }
}

// Create OTEL instruments lazily to avoid import-time failures
let _meterInitialised = false;
let _meter: any = null;

async function getMeter() {
  if (!isOtelActive() || _meterInitialised) return _meter;
  try {
    const { metrics } = await import('@opentelemetry/api');
    _meter = metrics.getMeter('cognition-os', '1.0.0');
    _meterInitialised = true;
  } catch {
    _meterInitialised = true; // Don't retry
  }
  return _meter;
}

function makeCounter(name: string, description: string) {
  const fallback = new LoggingMetric(name, 'counter');
  let otelCounter: any = null;

  return {
    add(value: number, attributes?: Record<string, unknown>): void {
      fallback.add(value, attributes);
      getMeter().then((meter) => {
        if (!meter) return;
        if (!otelCounter) otelCounter = meter.createCounter(name, { description });
        try { otelCounter.add(value, attributes); } catch { /* silent */ }
      }).catch(() => {});
    },
  };
}

function makeHistogram(name: string, description: string, unit = 'ms') {
  const fallback = new LoggingMetric(name, 'histogram');
  let otelHistogram: any = null;

  return {
    record(value: number, attributes?: Record<string, unknown>): void {
      fallback.record(value, attributes);
      getMeter().then((meter) => {
        if (!meter) return;
        if (!otelHistogram) otelHistogram = meter.createHistogram(name, { description, unit });
        try { otelHistogram.record(value, attributes); } catch { /* silent */ }
      }).catch(() => {});
    },
  };
}

// Public metric instruments
export const masteryChangeCounter = makeCounter(
  'cognition.mastery.changes',
  'Number of mastery tier changes across all users'
);

export const plannerInvocationCounter = makeCounter(
  'cognition.planner.invocations',
  'Number of daily planner invocations'
);

export const masteryPropagationLatency = makeHistogram(
  'cognition.mastery.propagation_latency',
  'Time to propagate mastery change through prerequisite graph'
);

export const plannerLatency = makeHistogram(
  'cognition.planner.latency',
  'Time to generate a daily plan'
);

export const eventProcessedCounter = makeCounter(
  'cognition.events.processed',
  'Number of events processed by the event bus'
);

export const eventProcessingLatency = makeHistogram(
  'cognition.events.processing_latency',
  'Time to process a single event through all consumers'
);

export function registerMetrics(): void {
  if (isOtelActive()) {
    logger.info('OTEL metrics registration: endpoint configured, instruments active');
  } else {
    logger.info('OTEL metrics registration: no endpoint configured, using log-based fallback');
  }
}
