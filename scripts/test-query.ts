import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testQuery() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, metadata')
    .eq('metadata->>completion_key', 'session-card:Waves and Respiration in Humans:2026-06-02')
    .limit(1);

  console.log({ data, error });
}

testQuery().catch(console.error);
