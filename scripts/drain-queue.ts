import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function drainQueue() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('Fetching pending events...');
  
  // Get counts
  const { data: counts } = await supabase.from('event_consumer_locks').select('status');
  console.log(`Total locks: ${counts?.length}`);

  // Delete all pending locks for AUTOPSY_MISTAKE_APPROVED since they are failing and clogging
  console.log('Cleaning up failing autopsy events to unblock queue...');
  
  const { data: stuckEvents } = await supabase
    .from('student_events')
    .select('id')
    .eq('type', 'AUTOPSY_MISTAKE_APPROVED');
    
  if (stuckEvents && stuckEvents.length > 0) {
    const ids = stuckEvents.map(e => e.id);
    await supabase.from('event_consumer_locks').delete().in('event_id', ids);
    await supabase.from('student_events').delete().in('id', ids);
    console.log(`Deleted ${ids.length} AUTOPSY_MISTAKE_APPROVED events that were clogging the queue.`);
  }

  console.log('Done.');
}

drainQueue().catch(console.error);
