const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'REDIS_URL',
  'CRON_SECRET',
] as const;

export function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const message = `
============================================================
COGNITION OS — MISSING REQUIRED ENVIRONMENT VARIABLES
============================================================
${missing.map(k => `  ❌  ${k}`).join('\n')}

  REDIS_URL    → Upstash free tier: https://upstash.com
  CRON_SECRET  → Any random string: openssl rand -hex 32
  GEMINI_API_KEY → https://aistudio.google.com
============================================================`;

    console.error(message);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
  }
}
