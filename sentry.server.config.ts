import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN && process.env.SENTRY_DSN !== "YOUR_SENTRY_DSN_HERE") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
