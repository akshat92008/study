import { createAdminClient } from '../lib/supabase/admin';
import { EventWorkerService } from '../lib/events/worker';

async function runSmokeTest() {
  console.log('Starting 10-user Private Alpha Smoke Test...');
  const supabase = createAdminClient();
  
  // Create 10 mock users
  const users = [];
  for (let i = 0; i < 10; i++) {
    const { data: user } = await supabase.auth.admin.createUser({
      email: `alpha10_test_user_${i}_${Date.now()}@example.com`,
      password: 'password123',
      email_confirm: true,
    });
    if (user?.user) users.push(user.user.id);
  }

  console.log(`Created ${users.length} test users.`);

  // Simulate 5 events per user (Chat messages -> queue)
  let eventsInserted = 0;
  for (const userId of users) {
    for (let j = 0; j < 5; j++) {
      await supabase.from('event_queue').insert({
        event_type: 'CHAT_MESSAGE_PROCESSED',
        payload: {
          message: 'Hello world',
          role: 'user',
        },
        user_id: userId,
        status: 'PENDING',
      });
      eventsInserted++;
    }
  }

  console.log(`Queued ${eventsInserted} CHAT_MESSAGE_PROCESSED events.`);

  // Drain the queue
  console.log('Running event worker batch...');
  let totalProcessed = 0;
  let totalFailed = 0;
  
  for (let i = 0; i < 3; i++) {
    const result = await EventWorkerService.processBatch(25, 5);
    totalProcessed += result.processed;
    totalFailed += result.failed;
    console.log(`Batch ${i + 1}: processed=${result.processed}, failed=${result.failed}, skipped=${result.skipped}`);
    if (result.processed === 0 && result.failed === 0 && result.skipped === 0) break;
  }

  const { data: dlq } = await supabase.from('event_dlq').select('id', { count: 'exact' });
  const { data: pending } = await supabase.from('event_queue').select('id', { count: 'exact' }).eq('status', 'PENDING');

  console.log('\n--- SMOKE TEST RESULTS ---');
  console.log(`Total Events Inserted: ${eventsInserted}`);
  console.log(`Total Processed: ${totalProcessed}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log(`Remaining Pending: ${pending?.length || 0}`);
  console.log(`DLQ Size: ${dlq?.length || 0}`);

  if ((pending?.length || 0) === 0 && (dlq?.length || 0) === 0 && totalFailed === 0) {
    console.log('✅ TEST PASSED: Queue drained cleanly.');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED: Issues in queue processing.');
    process.exit(1);
  }
}

runSmokeTest().catch(console.error);
