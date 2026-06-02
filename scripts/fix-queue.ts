import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fixQueue() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Marking clogged events as DLQ...');
  
  // Update all PENDING events that are NOT MATERIAL_UPLOADED to DLQ so they don't block the queue
  const { data, error } = await supabase
    .from('event_queue')
    .update({ status: 'DLQ' })
    .eq('status', 'PENDING')
    .neq('type', 'MATERIAL_UPLOADED');
    
  if (error) {
    console.error('Error updating queue:', error);
  } else {
    console.log('Successfully cleared blocking events from queue.');
  }
}

fixQueue().catch(console.error);
