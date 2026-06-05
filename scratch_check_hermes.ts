import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkHermes() {
  const { data: locks, error: lErr } = await supabase
    .from('consumer_locks')
    .select('event_id, status, last_error, updated_at')
    .eq('consumer_name', 'hermes_worker')
    .order('updated_at', { ascending: false })
    .limit(5);
    
  console.log('--- RECENT HERMES LOCKS ---');
  console.log(JSON.stringify(locks, null, 2));

  const { data: mistakes, error: mErr } = await supabase
    .from('mistakes')
    .select('id, category, diagnosis, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n--- RECENT MISTAKES ---');
  console.log(JSON.stringify(mistakes, null, 2));
}

checkHermes();
