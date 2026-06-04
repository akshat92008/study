export function validateEnv() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing: string[] = [];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      missing.push(v);
    }
  }

  if (missing.length > 0) {
    console.warn('⚠️ Missing required environment variables: ' + missing.join(', '));
    // In production, we might want to throw an error, but warning is safer to prevent unexpected crash loops
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: Production environment is missing required variables.');
    }
  }
}

// Optionally call it during module load, but only in non-build steps if possible.
// Because Next.js build might not have all runtime vars.
if (process.env.NODE_ENV !== 'test' && !process.env.CI) {
  validateEnv();
}
