import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '../lib/supabase/server';
import { completeOnboarding } from '../lib/actions/onboarding';

async function test() {
  try {
    const supabase = await createClient();
    
    // Get the first user in profiles to use as a test case
    const { data: profileRow } = await supabase.from('profiles').select('id').limit(1).single();
    if (!profileRow) {
      console.log("No profile row found. Let's create one.");
      // If no profile, try to get a user from auth
      const { data: { users } } = await supabase.auth.admin.listUsers();
      console.log("Auth Users:", users.map(u => ({ id: u.id, email: u.email })));
      return;
    }
    
    console.log("Running completeOnboarding for user ID:", profileRow.id);
    const res = await completeOnboarding(
      profileRow.id,
      "NEET", 
      "2026-05-01", 
      []
    );
    console.log("SUCCESS:", res);
  } catch (err: any) {
    console.error("CRITICAL ERROR:", err);
    if (err.message) console.error("Error Message:", err.message);
    if (err.stack) console.error("Error Stack:", err.stack);
  }
}

test();
