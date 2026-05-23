const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'NEXT_PUBLIC_APP_URL',
  // ✅ FIX: Redis is a hard dependency for the event queue. Missing = silent failure.
  'REDIS_URL',
  // ✅ FIX: Cron secret prevents unauthorized cron triggering.
  'CRON_SECRET',
] as const;

// These are only required in production. Missing in dev is fine.
const PROD_ONLY_ENV_VARS: string[] = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
];

export function validateEnvironment(): void {
  const isProd = process.env.NODE_ENV === 'production';

  const missing = REQUIRED_ENV_VARS.filter((key) => {
    if (!isProd && PROD_ONLY_ENV_VARS.includes(key)) return false; // OK to skip in dev
    return !process.env[key];
  });

  if (missing.length > 0) {
    const message = `
============================================================
COGNITION OS — MISSING REQUIRED ENVIRONMENT VARIABLES
============================================================
The following variables are not set:

${missing.map((k) => `  ❌  ${k}`).join('\n')}

Set them in .env.local (development) or your Vercel environment (production).

Quick guide:
  REDIS_URL        → Upstash Redis URL (free tier works fine for dev)
  CRON_SECRET      → Any random string, e.g. openssl rand -hex 32
  GEMINI_API_KEY   → Google AI Studio → Get API key
============================================================`;

    console.error(message);

    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
  }
}
