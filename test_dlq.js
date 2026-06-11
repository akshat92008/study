const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ubzvhajvcoiovkgwnsgu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVienZoYWp2Y29pb3ZrZ3duc2d1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxNDE0NSwiZXhwIjoyMDk0MDkwMTQ1fQ.rnCUgSPoqaWLzERdZ5oR8Zt82ynjctnUDytn2sKXflI', { auth: { persistSession: false } });

async function run() {
  const { data, error } = await supabase.from('event_dlq').select('*').limit(5);
  console.log('DLQ:', JSON.stringify(data, null, 2));
  
  const { data: queue, error: queueErr } = await supabase.from('consumer_locks').select('*').limit(5);
  console.log('Queue Locks:', JSON.stringify(queue, null, 2));
}
run();
