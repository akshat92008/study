// sentry.client.config.ts
// This file is loaded by @sentry/nextjs for client-side (browser) error capture.
// It runs in the browser, so no server-only imports.
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Only capture 10% of traces in production to avoid quota burn
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Replay captures user sessions on errors — opt-in
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.01,
    integrations: [
      Sentry.replayIntegration({
        // Mask all text and inputs by default to protect student PII
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Strip PII from events before sending
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}
