// lib/telemetry/metrics.ts

class NoopMetric {
  add(value: number, attributes?: Record<string, any>): void {}
  record(value: number, attributes?: Record<string, any>): void {}
}

const noop = new NoopMetric();

export const masteryChangeCounter = noop;
export const plannerInvocationCounter = noop;
export const masteryPropagationLatency = noop;
export const plannerLatency = noop;
export const eventProcessedCounter = noop;
export const eventProcessingLatency = noop;

export function registerMetrics(): void {
  // No-op
}
