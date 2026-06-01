const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('event_queue').select('*').eq('type', 'COMMAND_SESSION_COMPLETED').limit(5);
  console.log('Error:', error);
  console.log('Events:', data);
  
  // also check consumer locks for these
  if (data && data.length > 0) {
    const { data: locks } = await supabase.from('consumer_locks').select('*').in('event_id', data.map(d => d.id));
    console.log('Locks:', locks);
  }
}

check();
