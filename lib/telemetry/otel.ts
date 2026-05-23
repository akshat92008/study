// lib/telemetry/otel.ts

initTelemetry();

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { env } from '@/lib/utils/env'; // helper to read env vars (you may create a tiny wrapper)

// Enable OpenTelemetry internal diagnostics (optional)
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Resource attributes (service name, version, etc.)
const resource = new Resource({
  'service.name': env('OTEL_RESOURCE_SERVICE_NAME') ?? 'cognition-os',
  'service.version': env('OTEL_RESOURCE_SERVICE_VERSION') ?? '1.0.0',
});

/**
 * Initialize tracing and metrics.
 * Call this once at application start‑up.
 */
export function initTelemetry(): void {
  // ---- Tracing ----
  const tracerProvider = new NodeTracerProvider({ resource });
  const otlpEndpoint = env('OTEL_EXPORTER_OTLP_ENDPOINT') ?? 'http://localhost:4318';
  const otlpHeaders = env('OTEL_EXPORTER_OTLP_HEADERS');
  const exporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
    headers: otlpHeaders ? JSON.parse(otlpHeaders) : undefined,
  });
  tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
  tracerProvider.register();

  // ---- Metrics ----
  const prometheusPort = Number(env('PROMETHEUS_EXPORTER_PORT') ?? 9464);
  const prometheusEndpoint = env('PROMETHEUS_EXPORTER_ENDPOINT') ?? '/metrics';
  const prometheusExporter = new PrometheusExporter({
    port: prometheusPort,
    endpoint: prometheusEndpoint,
  }, () => {
    console.log(`Prometheus metrics exposed at http://localhost:${prometheusPort}${prometheusEndpoint}`);
  });
  const meterProvider = new MeterProvider({ resource });
  meterProvider.addMetricReader(prometheusExporter);
  // Register global meter provider (optional)
  // Note: In newer SDK versions, you can set the global meter provider via api.setMeterProvider
}

export const tracer = new NodeTracerProvider({ resource }).getTracer('cognition-os-tracer');
export const meter = new MeterProvider({ resource });

// Register auto‑instrumentations (HTTP, Express)
registerInstrumentations({
  tracerProvider: new NodeTracerProvider({ resource }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
});
