import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase.rpc('get_check_constraints');
  if (error) {
    // If RPC doesn't exist, try querying pg_constraint directly if possible, or just search files.
    console.error('Error:', error);
  } else {
    console.log(data);
  }
}

check();
