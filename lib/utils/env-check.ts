function isBuildPhase(): boolean {
  return (
    process.env.npm_lifecycle_event === 'build' ||
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.SKIP_ENV_VALIDATION === '1' ||
    process.env.SKIP_ENV_VALIDATION === 'true' ||
    process.env.CI === 'true'
  );
}

export function checkEnvironment(): void {
  // Never throw during Next.js build — env vars are injected at runtime, not build time.
  // Validation with throwing behaviour is handled by next.config.ts → validateEnvironment().
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    if (isBuildPhase()) {
      // During build, warn only — env vars arrive at runtime.
      console.warn('[ENV] Build-time check: these vars will be needed at runtime:', missing.join(', '));
      return;
    }
    // At runtime: this is fatal. Log the missing names, never the values.
    throw new Error(`[ENV] Missing required variable: ${missing[0]}`);
  }

  const aiProviders = [
    'CEREBRAS_API_KEY',
    'SAMBANOVA_API_KEY',
    'GROQ_API_KEY',
    'CF_API_TOKEN',
    'GEMINI_API_KEY',
  ];
  const active = aiProviders.filter((k) => !!process.env[k]);
  if (active.length === 0) {
    console.warn('[ENV] No AI provider configured. AI routes will use deterministic fallbacks where available.');
    return;
  }
  console.log('[ENV] Active AI providers:', active.join(', '));

  if (!process.env.INTERNAL_CRON_SECRET && !process.env.CRON_SECRET && !isBuildPhase()) {
    console.warn('[ENV] INTERNAL_CRON_SECRET and CRON_SECRET not set — daily synthesis cron is unprotected.');
  }
}
