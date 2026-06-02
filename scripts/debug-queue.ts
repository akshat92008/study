import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugQueue() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: queueCounts } = await supabase.from('event_queue').select('type, status');
  console.log('Event Queue Summary:');
  const summary: Record<string, number> = {};
  if (queueCounts) {
    for (const row of queueCounts) {
      const key = `${row.type} | ${row.status}`;
      summary[key] = (summary[key] || 0) + 1;
    }
  }
  console.log(summary);

  const { data: locks } = await supabase.from('event_consumer_locks').select('consumer_name, status, event_id');
  console.log('Locks Summary:');
  const lSummary: Record<string, number> = {};
  if (locks) {
    for (const lock of locks) {
      const key = `${lock.consumer_name} | ${lock.status}`;
      lSummary[key] = (lSummary[key] || 0) + 1;
    }
  }
  console.log(lSummary);
}

debugQueue().catch(console.error);
