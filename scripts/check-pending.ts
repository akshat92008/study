import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkPending() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: queue } = await supabase.from('event_queue').select('*').eq('status', 'PENDING');
  console.log('Pending events:');
  for (const q of queue || []) {
    console.log(`[${q.type}] id: ${q.id}, created: ${q.created_at}`);
  }
}

checkPending().catch(console.error);
