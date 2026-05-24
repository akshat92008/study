// lib/utils/env-check.ts

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
] as const;

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
] as const;

export function validateEnvironment(): void {
  const missingRequired = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  const missingOptional = OPTIONAL_ENV_VARS.filter(key => !process.env[key]);

  if (missingRequired.length > 0) {
    const message = `
============================================================
COGNITION OS — MISSING REQUIRED ENVIRONMENT VARIABLES
============================================================
${missingRequired.map(k => `  ❌  ${k}`).join('\n')}

  NEXT_PUBLIC_SUPABASE_URL      → Supabase project settings
  NEXT_PUBLIC_SUPABASE_ANON_KEY → Supabase project settings
  SUPABASE_SERVICE_ROLE_KEY     → Supabase project settings
  GEMINI_API_KEY                → https://aistudio.google.com
============================================================`;

    console.error(message);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`Missing required env vars: ${missingRequired.join(', ')}`);
    }
  }

  if (missingOptional.length > 0) {
    const warningMessage = `
============================================================
COGNITION OS — MISSING RECOMMENDED ENVIRONMENT VARIABLES
============================================================
${missingOptional.map(k => `  ⚠️  ${k}`).join('\n')}

  NEXT_PUBLIC_APP_URL           → Your Vercel deployment URL
  CRON_SECRET                   → Any random string: openssl rand -hex 32
============================================================`;
    console.warn(warningMessage);
  }
}