import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDb() {
  const { data: events, error: eErr } = await supabase
    .from('event_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('--- RECENT EVENTS ---');
  console.log(JSON.stringify(events, null, 2));

  const { data: jobs, error: jErr } = await supabase
    .from('rag_ingestion_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n--- RAG INGESTION JOBS ---');
  console.log(JSON.stringify(jobs, null, 2));
}

checkDb();
