import { trace as apiTrace, metrics as apiMetrics, SpanStatusCode } from '@opentelemetry/api';

export const tracer = apiTrace.getTracer('cognition-os-tracer');
export const trace = tracer;
export const meter = apiMetrics.getMeter('cognition-os-meter');

let _sdkInitialized = false;
let _sdkStarting = false;



export function initTelemetry(): void {
  // Only initialize once, only in Node.js (not Edge runtime), only if endpoint configured
  if (_sdkInitialized || _sdkStarting) return;
  if (typeof process === 'undefined') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // No exporter configured — tracer/meter still work but spans go nowhere
    // This is fine for local dev. Set OTEL_EXPORTER_OTLP_ENDPOINT in production.
    console.log('[OTel] No OTEL_EXPORTER_OTLP_ENDPOINT set — telemetry disabled');
    return;
  }

  _sdkStarting = true;
  void startTelemetry().finally(() => {
    _sdkStarting = false;
  });
}

async function startTelemetry(): Promise<void> {
  // Skip telemetry initialization for MVP to avoid build issues
  console.log('[OTel] Telemetry initialization skipped (MVP build)');
  _sdkInitialized = true;
}

// Utility: wrap an async fn in a span
export async function withSpan<T>(
  name: string,
  fn: (span: ReturnType<typeof tracer.startSpan>) => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(name);
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message });
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}
