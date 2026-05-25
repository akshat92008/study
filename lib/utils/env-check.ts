// lib/utils/env-check.ts
export function checkEnvironment(): void {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  const aiProviders = [
    'CEREBRAS_API_KEY',
    'SAMBANOVA_API_KEY', 
    'GROQ_API_KEY',
    'CF_API_TOKEN',
    'GOOGLE_AI_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // At least one AI provider must be configured
  const hasAnyProvider = aiProviders.some(key => !!process.env[key]);
  if (!hasAnyProvider) {
    throw new Error(
      'No AI provider configured. Set at least one of: ' + aiProviders.join(', ')
    );
  }

  // Log which providers are active (helpful for debugging)
  const activeProviders = aiProviders.filter(key => !!process.env[key]);
  console.log('[ENV] Active AI providers:', activeProviders.join(', '));
  
  if (!process.env.SAMBANOVA_API_KEY && !process.env.CF_API_TOKEN && !process.env.GOOGLE_AI_KEY) {
    console.warn('[ENV] Warning: No embedding provider configured. Semantic memory will be disabled.');
  }
}