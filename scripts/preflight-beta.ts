#!/usr/bin/env tsx

/**
 * Validates required environment variables for the Cognition OS private beta.
 * Does not leak secrets to stdout.
 */

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INTERNAL_CRON_SECRET',
  'ENABLE_AUTOPSY_PROCESSING',
  'AI_COST_MODE',
];

function checkRequired() {
  const missing = [];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      missing.push(v);
    }
  }
  
  if (missing.length > 0) {
    console.error('❌ Beta Preflight Failed: Missing required environment variables:');
    missing.forEach(m => console.error(`   - ${m}`));
    console.error('\nPlease set them in your .env file before starting the beta.');
    process.exit(1);
  }
  
  if (process.env.ENABLE_AUTOPSY_PROCESSING !== 'true') {
    console.warn('⚠️ Warning: ENABLE_AUTOPSY_PROCESSING is not set to "true". Autopsy will be disabled.');
  }
  
  if (process.env.AI_COST_MODE !== 'ultra_cheap' && process.env.AI_COST_MODE !== 'cheap') {
    console.warn(`⚠️ Warning: AI_COST_MODE is set to "${process.env.AI_COST_MODE}". Recommended is "ultra_cheap" or "cheap" for beta.`);
  }

  console.log('✅ Beta Preflight Passed.');
}

checkRequired();
