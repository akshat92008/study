import { loadSentry } from '@/lib/telemetry/sentry-runtime';

void loadSentry()
  .then((Sentry) => Sentry?.init?.({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.05,
  }))
  .catch(() => {});
