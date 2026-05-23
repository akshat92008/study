// lib/telemetry/metrics.ts

import { MeterProvider, metrics } from '@opentelemetry/api';
import { meter as meterProvider } from './otel';

// Initialize a meter (using the same provider as otel.ts)
const meter = meterProvider.getMeter('cognition-metrics');

/** Counter for mastery change events */
export const masteryChangeCounter = meter.createCounter('cognition_mastery_changes', {
  description: 'Number of mastery change events processed',
});

/** Counter for AdaptivePlanner invocations */
export const plannerInvocationCounter = meter.createCounter('cognition_planner_invocations', {
  description: 'Number of times AdaptivePlanner.plan() is called',
});

/** Histogram for processing latency of mastery propagation (ms) */
export const masteryPropagationLatency = meter.createHistogram('cognition_mastery_propagation_latency', {
  description: 'Latency of mastery propagation handling (milliseconds)',
  unit: 'ms',
});

/** Histogram for planner latency (ms) */
export const plannerLatency = meter.createHistogram('cognition_planner_latency', {
  description: 'Latency of AdaptivePlanner.plan() execution (milliseconds)',
  unit: 'ms',
});

// Export a helper to register the metrics at startup (optional)
export function registerMetrics() {
  // No-op for now – metrics are created on import.
}
