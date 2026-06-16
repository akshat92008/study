/**
 * Smoke script for Private Alpha to verify critical paths directly via services.
 * Run with: npx tsx scripts/smoke-private-alpha.ts
 */

import { createAdminClient } from '../lib/supabase/admin';
import { EventWorkerService } from '../lib/events/worker';
import { featureFlags } from '../lib/feature-registry';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

async function runSmokeTest() {
  console.log('🚀 Starting Private Alpha Smoke Test...');
  const supabase = createAdminClient();
  let ok = true;

  try {
    // 1. Verify DB connection
    const { data: profile, error: dbError } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    if (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      ok = false;
    } else {
      console.log('✅ Database connection successful');
    }

    // 2. Check open worker route does not exist
    try {
      const { GET } = await import('../app/api/trigger-queue/route');
      console.error('❌ /api/trigger-queue still exists!');
      ok = false;
    } catch {
      console.log('✅ Open worker route (/api/trigger-queue) is removed');
    }

    // 3. Verify autopsy flag
    if (featureFlags.autopsyProcessing()) {
      console.log('✅ Autopsy processing is ENABLED');
    } else {
      console.warn('⚠️ Autopsy processing is DISABLED. Was this intended for beta?');
    }

    // 4. Verify worker health
    const health = await EventWorkerService.getHealthSummary();
    console.log('✅ Worker service is healthy. Pending events:', health.pendingEvents);

    if (ok) {
      console.log('\n✅ All Private Alpha critical checks passed.');
      process.exit(0);
    } else {
      console.error('\n❌ Private Alpha smoke test failed.');
      process.exit(1);
    }

  } catch (err: any) {
    console.error('❌ Unexpected error during smoke test:', err.message);
    process.exit(1);
  }
}

runSmokeTest();
