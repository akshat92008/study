import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function debugEvents() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase env vars missing.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('--- Event Bus Health Debug ---\n');

  // Pending events
  const { count: pendingCount, error: pErr } = await supabase
    .from('student_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  if (pErr) console.error('Error fetching pending:', pErr);
  else console.log(`Pending events: ${pendingCount}`);

  // Failed events
  const { count: failedCount, error: fErr } = await supabase
    .from('student_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  if (fErr) console.error('Error fetching failed:', fErr);
  else console.log(`Failed events: ${failedCount}`);

  // Locked events older than 10 mins (stuck processing)
  const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
  const { count: stuckCount, error: sErr } = await supabase
    .from('student_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing')
    .lt('created_at', tenMinsAgo);

  if (sErr) console.error('Error fetching stuck:', sErr);
  else console.log(`Stuck (processing > 10m): ${stuckCount}`);

  // Group by type and status
  const { data: grouped, error: gErr } = await supabase
    .from('student_events')
    .select('type, status');

  if (gErr) {
    console.error('Error fetching all events for group:', gErr);
  } else if (grouped) {
    const summary: Record<string, number> = {};
    for (const evt of grouped) {
      const key = `${evt.type} | ${evt.status}`;
      summary[key] = (summary[key] || 0) + 1;
    }
    console.log('\nGrouped by Type & Status:');
    for (const [k, v] of Object.entries(summary)) {
      console.log(`  - ${k}: ${v}`);
    }
  }

  // Last error samples
  const { data: errors, error: leErr } = await supabase
    .from('student_events')
    .select('id, type, last_error, updated_at')
    .not('last_error', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (leErr) {
    console.error('Error fetching last_errors:', leErr);
  } else if (errors && errors.length > 0) {
    console.log('\nRecent Errors:');
    for (const err of errors) {
      console.log(`  - [${err.type}] ${err.id} (${err.updated_at}): ${err.last_error}`);
    }
  }

  // Consumer tracking
  const { data: consumers, error: cErr } = await supabase
    .from('event_consumer_tracking')
    .select('consumer_name, status')
    .limit(100);

  if (cErr) {
    console.log('\n⚠️ event_consumer_tracking table might not exist or error:', cErr.message);
  } else if (consumers) {
    console.log('\nConsumer Tracking Status:');
    const cSummary: Record<string, number> = {};
    for (const c of consumers) {
      const key = `${c.consumer_name} | ${c.status}`;
      cSummary[key] = (cSummary[key] || 0) + 1;
    }
    for (const [k, v] of Object.entries(cSummary)) {
      console.log(`  - ${k}: ${v}`);
    }
  }

  console.log('\nDone.');
}

debugEvents();
