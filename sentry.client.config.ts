// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isConfigured = dsn && dsn.length > 10 && dsn !== 'YOUR_NEXT_PUBLIC_SENTRY_DSN_HERE';

if (isConfigured) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    // Replay only on errors to save quota
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    enabled: process.env.NODE_ENV === 'production',
    integrations: [Sentry.replayIntegration()],
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}
