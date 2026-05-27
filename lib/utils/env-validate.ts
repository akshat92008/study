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
  { key: 'GEMINI_API_KEY', required: true, description: 'Google Gemini API key — all AI calls use this' },
  { key: 'CRON_SECRET', required: true, description: 'Secret for cron route auth — missing disables all overnight synthesis' },

  // Recommended — graceful degradation possible but features degrade
  { key: 'CEREBRAS_API_KEY', required: false, description: 'Cerebras fastest inference (optional but recommended)' },
  { key: 'GROQ_API_KEY', required: false, description: 'Groq fast inference (optional but recommended)' },
  { key: 'SAMBANOVA_API_KEY', required: false, description: 'SambaNova inference (optional)' },
  { key: 'NEXT_PUBLIC_APP_URL', required: false, description: 'Full app URL — needed for event retry HTTP calls' },
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

  if (missing.length > 0) {
    const message = [
      '\n❌ COGNITION OS — Critical environment variables missing. Server cannot start.\n',
      ...missing,
      '\nSet these in your .env.local file or Vercel environment settings.\n',
    ].join('\n');
    console.error(message);
    // In production throw hard. In test/development print and continue.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Critical environment variables missing. See console for details.');
    }
  }
}
