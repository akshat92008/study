import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace as apiTrace, metrics as apiMetrics, SpanStatusCode } from '@opentelemetry/api';

export const tracer = apiTrace.getTracer('cognition-os-tracer');
export const trace = tracer;
export const meter = apiMetrics.getMeter('cognition-os-meter');

let _sdkInitialized = false;

export function initTelemetry(): void {
  // Only initialize once, only in Node.js (not Edge runtime), only if endpoint configured
  if (_sdkInitialized) return;
  if (typeof process === 'undefined') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // No exporter configured — tracer/meter still work but spans go nowhere
    // This is fine for local dev. Set OTEL_EXPORTER_OTLP_ENDPOINT in production.
    console.log('[OTel] No OTEL_EXPORTER_OTLP_ENDPOINT set — telemetry disabled');
    return;
  }

  try {
    const traceExporter = new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + '/v1/traces',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    const sdk = new NodeSDK({
      // @ts-expect-error - Resource version mismatch between OTel packages
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: 'cognition-os',
        [SEMRESATTRS_SERVICE_VERSION]: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
      }),
      // @ts-expect-error - SpanProcessor version mismatch between OTel packages
      spanProcessor: new SimpleSpanProcessor(traceExporter),
    });

    sdk.start();
    _sdkInitialized = true;
    console.log('[OTel] Telemetry initialized →', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

    // Graceful shutdown
    process.on('SIGTERM', () => sdk.shutdown().catch(console.error));
  } catch (err) {
    console.error('[OTel] Failed to initialize telemetry:', err);
  }
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
