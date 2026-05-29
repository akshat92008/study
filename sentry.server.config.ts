// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;
const isConfigured = dsn && dsn.length > 10 && dsn !== 'YOUR_SENTRY_DSN_HERE';

if (isConfigured) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Only send errors in production; in dev they're already in the console
    enabled: process.env.NODE_ENV === 'production',
    // Strip PII before sending
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
  });
} else {
  // Warn loudly at boot so the operator knows
  console.warn(
    '[Sentry] DSN not configured or still set to placeholder. ' +
    'Error tracking is INACTIVE. Set SENTRY_DSN in your environment.'
  );
}
