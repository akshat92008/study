import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function run() {
  console.log("=== VERIFYING RLS IS ACTIVE AND ENFORCED ===");
  
  // 1. Create client with Anon Key (Should NOT bypass RLS)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  // 2. Create client with Service Role Key (Bypasses RLS)
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  
  // Query profiles using Admin client to check how many profiles exist
  const { data: adminProfiles, error: adminErr } = await adminClient.from('profiles').select('id, email');
  if (adminErr) {
    console.error("Admin client query failed:", adminErr.message);
    process.exit(1);
  }
  
  console.log(`Admin client saw ${adminProfiles?.length || 0} profiles.`);
  
  // Query profiles using Anon client
  const { data: anonProfiles, error: anonErr } = await anonClient.from('profiles').select('id, email');
  if (anonErr) {
    console.log("✅ Anon client query failed with error as expected under RLS (or returned empty):", anonErr.message);
  } else {
    console.log(`Anon client query succeeded and returned ${anonProfiles?.length || 0} profiles.`);
    if (anonProfiles && anonProfiles.length > 0 && adminProfiles && adminProfiles.length > 0) {
      console.error("❌ FAILURE: Anon client was able to see profiles data! RLS might be disabled or policy is too permissive!");
    } else {
      console.log("✅ RLS successfully hid profiles data from anonymous client.");
    }
  }

  // Let's check concepts table
  const { data: adminConcepts } = await adminClient.from('concepts').select('id, name').limit(5);
  console.log(`Admin client saw ${adminConcepts?.length || 0} concepts.`);
  
  const { data: anonConcepts, error: anonConceptErr } = await anonClient.from('concepts').select('id, name');
  if (anonConceptErr) {
    console.log("✅ Anon client concepts query failed/empty:", anonConceptErr.message);
  } else {
    if (anonConcepts && anonConcepts.length > 0) {
      console.error("❌ FAILURE: Anon client was able to see concepts data! RLS might be disabled!");
    } else {
      console.log("✅ RLS successfully hid concepts data from anonymous client.");
    }
  }
  
  console.log("=== RLS VERIFICATION COMPLETE ===");
}

run();
