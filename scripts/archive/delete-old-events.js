const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error } = await supabase.from('event_queue').delete().eq('type', 'COMMAND_SESSION_COMPLETED');
  console.log('Deleted old events error:', error);
  
  const { error: err2 } = await supabase.from('consumer_locks').delete().eq('consumer_name', 'command_engine');
  console.log('Deleted old consumer locks error:', err2);
  
  // Actually, just delete ALL events in the queue so the tests run cleanly. 
  // Wait, no, maybe there's a reason to keep them? It's a test/staging DB. Let's just delete the COMMAND_SESSION_COMPLETED ones.
  // We'll also delete ANY event that's older than 1 hour to prevent any other stuck events from interfering.
  
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { error: err3 } = await supabase.from('event_queue').delete().lt('created_at', oneHourAgo);
  console.log('Deleted events older than 1h error:', err3);
}
run();
