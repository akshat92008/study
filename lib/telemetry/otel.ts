// lib/telemetry/otel.ts
import { trace as apiTrace, metrics as apiMetrics } from '@opentelemetry/api';

export const tracer = apiTrace.getTracer('cognition-os-tracer');
export const trace = tracer; // Alias to support trace.startSpan()

export const meter = apiMetrics.getMeter('cognition-os-meter');

export function initTelemetry(): void {
  // No-op
}
