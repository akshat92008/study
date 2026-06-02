import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'test' + Date.now() + '@example.com';
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  if (authErr) { console.error('SignUp Error:', authErr); return; }
  
  const userId = authData.user!.id;
  console.log('User ID:', userId);

  // Insert a study material first
  const { data: material, error: matErr } = await supabase
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
    .select('id')
    .single();
    
  if (matErr) { console.error('Material Error:', matErr); return; }
  console.log('Material ID:', material.id);

  // Now test upsert
  const { data: job, error: jobErr } = await supabase
    .from('rag_ingestion_jobs')
    .upsert({
      user_id: userId,
      material_id: material.id,
      status: 'queued',
      idempotency_key: `rag_ingestion:${userId}:${material.id}`,
      metadata: { mimeType: 'application/pdf' },
    }, { onConflict: 'user_id,material_id,idempotency_key' })
    .select('*');

  if (jobErr) {
    console.error('Upsert Error:', jobErr);
  } else {
    console.log('Upsert Success:', job);
  }
}
run();
