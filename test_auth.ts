import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ubzvhajvcoiovkgwnsgu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVienZoYWp2Y29pb3ZrZ3duc2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTQxNDUsImV4cCI6MjA5NDA5MDE0NX0.iIokxf9RmDRYCJPvJ2t9DmdMy9o-xUncr6HHExDivu0'
);

async function main() {
  console.log("Testing signInAnonymously...");
  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
  console.log("Anon Error:", anonError);
  console.log("Anon User:", anonData?.user?.id);

  console.log("\nTesting signUp fallback...");
  const randomStr = Math.random().toString(36).substring(2, 10);
  const email = `guest_${randomStr}@cognition.os`;
  const password = `guest_${randomStr}_password`;
  
  const { data: signData, error: signError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: 'Guest User', is_guest: true },
    },
  });
  console.log("SignUp Error:", signError);
  console.log("SignUp User:", signData?.user?.id);
}

main();
