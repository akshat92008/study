// lib/utils/env-check.ts

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'NEXT_PUBLIC_APP_URL',
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

  NEXT_PUBLIC_SUPABASE_URL      → Supabase project settings
  NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase project settings
  SUPABASE_SERVICE_ROLE_KEY     → Supabase project settings
  GEMINI_API_KEY                → https://aistudio.google.com
  NEXT_PUBLIC_APP_URL           → Your Vercel deployment URL
  CRON_SECRET                   → Any random string: openssl rand -hex 32
============================================================`;

    console.error(message);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
  }
}