// lib/telemetry/sentry.ts
// Import this in instrumentation.ts (Next.js 15+ standard)
import { loadSentry } from '@/lib/telemetry/sentry-runtime';

interface SanitizableSentryEvent {
  user?: {
    email?: string;
    username?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  loadSentry().then((sentry) => {
    sentry?.init?.({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Don't leak user PII in breadcrumbs
      beforeSend(event: SanitizableSentryEvent) {
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
        }
        return event;
      },
    });
  }).catch(() => {});
}
