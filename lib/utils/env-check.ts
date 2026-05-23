const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'NEXT_PUBLIC_APP_URL'
] as const;

export function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const message = `
============================================================
COGNITION OS — MISSING REQUIRED ENVIRONMENT VARIABLES
============================================================
The following variables are not set in .env.local:

${missing.map(k => `  ❌  ${k}`).join('\n')}

The application cannot start safely without these values.
Set them in .env.local or your deployment environment.
============================================================`;
    console.error(message);
    // In development, hard crash so you can't miss it
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
  }
}
