import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabase.from('users').select('id').limit(1).single();
  if (!user) return console.log('no user');

  const { data, error } = await supabase
    .from('study_materials')
    .insert({
      user_id: user.id,
      title: 'test',
      original_filename: 'test.pdf',
      mime_type: 'application/pdf',
      storage_path: 'test/path',
      source_type: 'upload',
      language: 'en',
      status: 'uploaded',
      content_hash: '12345',
    })
    .select('id')
    .single();

  console.log('insert error:', error);
  console.log('inserted:', data);
}

test();
