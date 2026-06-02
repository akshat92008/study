import { createClient } from '@supabase/supabase-js';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be in process.env
// We bypass lib/supabase/admin to avoid server-only import errors in tsx

async function runSmokeTest() {
  console.log('=== PRIVATE BETA SMOKE TEST ===');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ WARNING: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.warn('Smoke test skipping DB checks. Export these variables to run DB checks.');
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let passCount = 0;
  let failCount = 0;

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passCount++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`, err.message);
      failCount++;
    }
  };

  await runTest('DB Connection & Profiles', async () => {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
  });

  await runTest('Study Materials Table Schema', async () => {
    const { error } = await supabase.from('study_materials').select('id, deleted_at').limit(1);
    if (error && !error.message.includes('Results contain 0 rows')) throw error;
  });

  await runTest('Mock Autopsies Schema', async () => {
    const { error } = await supabase.from('mock_autopsies').select('id').limit(1);
    if (error && !error.message.includes('Results contain 0 rows')) throw error;
  });

  await runTest('Queue Lock Schema', async () => {
    const { error } = await supabase.from('consumer_locks').select('id').limit(1);
    if (error && !error.message.includes('Results contain 0 rows')) throw error;
  });

  await runTest('Agent Runs Schema', async () => {
    const { error } = await supabase.from('agent_runs').select('id').limit(1);
    if (error && !error.message.includes('Results contain 0 rows')) throw error;
  });

  console.log('--------------------------------');
  console.log(`SMOKE TEST RESULTS: ${passCount} PASS | ${failCount} FAIL`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runSmokeTest().catch((err) => {
  console.error('Smoke test crashed', err);
  process.exit(1);
});
