import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkJobs() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Fetching rag_ingestion_jobs...');
  const { data, error } = await supabase.from('rag_ingestion_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  
  if (error) console.error(error);
  else console.log(data);

  const { data: mats, error: mErr } = await supabase.from('study_materials').select('*').order('created_at', { ascending: false }).limit(5);
  if (mErr) console.error(mErr);
  else console.log(mMats);
}

checkJobs().catch(console.error);
