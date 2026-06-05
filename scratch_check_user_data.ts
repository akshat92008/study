import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkData() {
  const { data: mistakes, error: mErr } = await supabase
    .from('mistakes')
    .select('id, category, diagnosis, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n--- ALL RECENT MISTAKES IN DB ---');
  console.log(JSON.stringify(mistakes, null, 2));
}

checkData();
