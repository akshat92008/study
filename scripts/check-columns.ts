import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('query_schema', { query: "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'study_tasks'" });
  if (error) {
    // try direct raw query using rest if rpc fails
    const { data: cols, error: e2 } = await supabase.from('study_tasks').select('*').limit(1);
    console.log(cols);
  } else {
    console.log(data);
  }
}

checkColumns();
