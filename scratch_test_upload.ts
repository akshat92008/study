import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = 'user-1'; // use an existing user id or any UUID for testing
  
  // try inserting a study material
  const { data, error } = await supabase
    .from('study_materials')
    .insert({
      user_id: 'd9b9c9e8-1111-4444-8888-abcdefabcdef',
      title: 'test',
      original_filename: 'test.pdf',
      mime_type: 'application/pdf',
      storage_path: 'test/path',
      source_type: 'upload',
      language: 'en',
      status: 'uploaded',
      content_hash: '12345',
    });

  console.log('insert error:', error);
}

test();
