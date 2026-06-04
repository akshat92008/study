// instrumentation.ts  (Next.js runs this before the app starts)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTelemetry } = await import('@/lib/telemetry/otel');
    const { initSentry } = await import('@/lib/telemetry/sentry');
    const { checkEnvironment } = await import('@/lib/utils/env-check');
    initTelemetry();
    initSentry();
    checkEnvironment();
  }
}
