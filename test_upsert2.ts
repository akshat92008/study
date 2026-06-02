import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'test2' + Date.now() + '@example.com';
  const { data: authData } = await supabase.auth.signUp({ email, password: 'password123' });
  const userId = authData.user!.id;

  const { data: material } = await supabase
    .from('study_materials')
    .insert({
      user_id: userId,
      title: 'test',
      original_filename: 'test.pdf',
      mime_type: 'application/pdf',
      storage_path: 'test/path',
      status: 'uploaded',
      content_hash: 'hash' + Date.now()
    })
    .select('id').single();

  const payload = {
      user_id: userId,
      material_id: material!.id,
      status: 'queued',
      idempotency_key: `rag_ingestion:${userId}:${material!.id}`,
      metadata: { mimeType: 'application/pdf' },
  };

  // First upsert
  const { error: err1 } = await supabase.from('rag_ingestion_jobs').upsert(payload, { onConflict: 'user_id,material_id,idempotency_key' });
  console.log('Err1:', err1?.message || 'Success');

  // Second upsert
  const { error: err2 } = await supabase.from('rag_ingestion_jobs').upsert(payload, { onConflict: 'user_id,material_id,idempotency_key' });
  console.log('Err2:', err2?.message || 'Success');
}
run();
