// lib/telemetry/sentry.ts
// Import this in instrumentation.ts (Next.js 15+ standard)
export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  // Dynamic import so it only loads server-side
  import('@sentry/nextjs').then(({ init }) => {
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Don't leak user PII in breadcrumbs
      beforeSend(event) {
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
        }
        return event;
      },
    });
  });
}
