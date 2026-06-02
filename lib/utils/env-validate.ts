/**
 * Validates required environment variables at startup.
 * Call this from next.config.ts so it runs before any request is handled.
 * Throws on missing CRITICAL variables. Warns on RECOMMENDED variables.
 */

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Critical — app will not function without these
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, description: 'Supabase anon key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key (server-side)' },
  { key: 'INTERNAL_CRON_SECRET', required: true, description: 'Secret for cron route auth — missing disables all overnight synthesis' },
  { key: 'ADMIN_EMAILS', required: true, description: 'Comma-separated list of admin emails' },
  { key: 'GEMINI_API_KEY', required: true, description: 'Google Gemini API key — used for embeddings and fast generation' },

  // Recommended — graceful degradation possible but features degrade
  { key: 'UPSTASH_REDIS_REST_URL', required: false, description: 'Upstash Redis URL for rate limiting and cache' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: false, description: 'Upstash Redis Token' },
  { key: 'CEREBRAS_API_KEY', required: false, description: 'Cerebras fastest inference (optional but recommended)' },
  { key: 'GROQ_API_KEY', required: false, description: 'Groq fast inference (optional but recommended)' },
  { key: 'SAMBANOVA_API_KEY', required: false, description: 'SambaNova inference (optional)' },
  { key: 'NEXT_PUBLIC_APP_URL', required: false, description: 'Full app URL — needed for event retry HTTP calls' },
  { key: 'SENTRY_DSN', required: false, description: 'Sentry DSN for error tracking — without this, all production errors are invisible' },
  { key: 'NEXT_PUBLIC_SENTRY_DSN', required: false, description: 'Sentry DSN for client-side error tracking' },
];

export function validateEnvironment(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];
    if (!value || value.trim() === '') {
      if (envVar.required) {
        missing.push(`  MISSING [CRITICAL] ${envVar.key} — ${envVar.description}`);
      } else {
        warnings.push(`  MISSING [OPTIONAL] ${envVar.key} — ${envVar.description}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  COGNITION OS — Optional environment variables not set:');
    warnings.forEach(w => console.warn(w));
    console.warn('');
  }

  // Warn if embeddings are explicitly disabled — this kills semantic memory.
  if (process.env.DISABLE_EMBEDDINGS === 'true') {
    const embeddingWarn = [
      '\n⚠️  COGNITION OS — DISABLE_EMBEDDINGS=true is set.',
      '   Semantic memory, RAG retrieval, and the "AI knows you" feature are all OFF.',
      '   Set DISABLE_EMBEDDINGS=false in production to enable the full product.\n',
    ].join('\n');
    console.warn(embeddingWarn);

    if (process.env.NODE_ENV === 'production') {
      // In production this is always a mistake — make it loud.
      console.error('❌ CRITICAL: DISABLE_EMBEDDINGS=true in a production environment. This disables the core product value proposition.');
    }
  }

  if (missing.length > 0) {
    const message = [
      '\n❌ COGNITION OS — Critical environment variables missing.\n',
      ...missing,
      '\nSet these in your .env.local file or Vercel environment settings.\n',
    ].join('\n');
    console.error(message);
    
    // Don't crash during build steps so we can successfully deploy to Vercel
    if (
      process.env.npm_lifecycle_event === 'build' ||
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.SKIP_ENV_VALIDATION === '1' ||
      process.env.SKIP_ENV_VALIDATION === 'true'
    ) {
      console.warn('⚠️  Skipping critical environment validation crash because we are in a build step or validation is explicitly skipped.');
    } else {
      throw new Error('Critical environment variables missing. See console for details.');
    }
  }

  const sentryDsn = process.env.SENTRY_DSN;
  if (!sentryDsn || sentryDsn === 'YOUR_SENTRY_DSN_HERE') {
    console.error(
      '\n⚠️  COGNITION OS — SENTRY_DSN is not configured.\n' +
      '   You will be COMPLETELY BLIND to production errors.\n' +
      '   Get a free DSN at https://sentry.io and set it in your environment.\n'
    );
  }
}
