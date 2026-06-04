export function checkEnvironment(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`[ENV] Missing required variable: ${key}`);
    }
  }

  const aiProviders = [
    'CEREBRAS_API_KEY',
    'SAMBANOVA_API_KEY',
    'GROQ_API_KEY',
    'CF_API_TOKEN',
    'GEMINI_API_KEY',
  ];

  const active = aiProviders.filter(k => !!process.env[k]);
  if (active.length === 0) {
    console.warn('[ENV] No AI provider configured. AI routes will use deterministic fallbacks where available.');
    return;
  }

  console.log('[ENV] Active AI providers:', active.join(', '));

  if (!process.env.INTERNAL_CRON_SECRET) {
    console.warn('[ENV] INTERNAL_CRON_SECRET not set — daily synthesis cron is unprotected.');
  }
}
