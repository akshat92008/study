type SentryModule = Record<string, any>;

const runtimeImport = new Function('specifier', 'return import(specifier)') as <T = SentryModule>(
  specifier: string
) => Promise<T>;

let sentryPromise: Promise<SentryModule | null> | null = null;

export function loadSentry(): Promise<SentryModule | null> {
  if (!sentryPromise) {
    sentryPromise = runtimeImport<SentryModule>('@sentry/nextjs').catch(() => null);
  }
  return sentryPromise;
}

export function withSentry(action: (sentry: SentryModule) => void): void {
  void loadSentry()
    .then((sentry) => {
      if (sentry) action(sentry);
    })
    .catch(() => {});
}

export function captureSentryException(error: unknown, options?: Record<string, unknown>): void {
  withSentry((sentry) => sentry.captureException?.(error, options));
}
