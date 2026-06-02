import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.BASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('FAIL Supabase env vars missing. Need NEXT_PUBLIC_SUPABASE_URL (or BASE_URL) and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Configuration
const BETA_TEST_USERS = parseInt(process.env.BETA_TEST_USERS ?? '100', 10);
const MESSAGES_PER_USER = parseInt(process.env.MESSAGES_PER_USER ?? '5', 10);
const UPLOAD_TEST = process.env.UPLOAD_TEST === 'true';
const PRACTICE_TEST = process.env.PRACTICE_TEST !== 'false'; // default true
const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const MOCK_MODE = process.env.MOCK_MODE !== 'false'; // default true (do not burn API quota)

console.log(`\n==================================================`);
console.log(`🚀 MODULE 4 — 100-USER REALISTIC LOAD/SMOKE TEST`);
console.log(`==================================================\n`);

console.log(`Configuration:`);
console.log(` - Users: ${BETA_TEST_USERS}`);
console.log(` - Messages/User: ${MESSAGES_PER_USER}`);
console.log(` - Practice Test: ${PRACTICE_TEST}`);
console.log(` - Upload Test: ${UPLOAD_TEST}`);
console.log(` - Mock Mode: ${MOCK_MODE} (Safe/Local Default)`);
console.log(` - Target URL: ${BASE_URL}\n`);

if (!MOCK_MODE) {
  console.log(`⚠️ WARNING: Running with MOCK_MODE=false will make REAL requests to the API.`);
  console.log(`   This will consume AI quota. Estimated AI calls: ${BETA_TEST_USERS * MESSAGES_PER_USER}`);
} else {
  console.log(`✅ Running in MOCK mode. Will simulate load directly on DB/Queue without burning AI quota.`);
}

console.log(`\nInstructions for Staging:`);
console.log(` 1. Set BASE_URL=https://staging.neetapp.com`);
console.log(` 2. Set SUPABASE_SERVICE_ROLE_KEY=<staging-service-key>`);
console.log(` 3. Set MOCK_MODE=false (if you want real AI API calls, otherwise keep true for DB load only)`);
console.log(` 4. Run: npx tsx scripts/beta100-load-test.ts\n`);

const state = {
  usersCreated: 0,
  chatRequests: 0,
  failedRequests: 0,
  eventsCreated: 0,
  latencies: [] as number[],
  userIds: [] as string[],
  sessionIds: [] as string[],
  messageIds: [] as string[],
  eventIds: [] as string[],
};

function fail(msg: string): never {
  console.error(`❌ FAIL: ${msg}`);
  process.exit(1);
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test artifacts...');
  try {
    if (state.eventIds.length) {
      // Chunk deletions to avoid URL too long or payload too large
      const chunkSize = 100;
      for (let i = 0; i < state.eventIds.length; i += chunkSize) {
        const chunk = state.eventIds.slice(i, i + chunkSize);
        await supabase.from('consumer_locks').delete().in('event_id', chunk);
        await supabase.from('event_attempts').delete().in('event_id', chunk);
        await supabase.from('event_queue').delete().in('id', chunk);
      }
    }
    
    // Batch delete users to cascade delete everything else
    const chunkSize = 50;
    for (let i = 0; i < state.userIds.length; i += chunkSize) {
      const chunk = state.userIds.slice(i, i + chunkSize);
      await Promise.all(chunk.map(id => supabase.auth.admin.deleteUser(id)));
    }
    console.log(`✅ Cleanup complete. Deleted ${state.userIds.length} users and their data.`);
  } catch (err) {
    console.error('⚠️ Cleanup failed:', err);
  }
}

async function simulateUserLoad(userIndex: number, runId: string) {
  const email = `loadtest-${runId}-${userIndex}@example.com`;
  const password = 'BetaLoadTest!123';
  
  const startUser = Date.now();
  
  // 1. Create User
  const { data: auth, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !auth.user) {
    state.failedRequests++;
    return;
  }
  const userId = auth.user.id;
  state.userIds.push(userId);
  state.usersCreated++;

  // Profile
  await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: `Load User ${userIndex}`,
    exam_type: 'neet',
    timezone: 'Asia/Kolkata',
  });

  // 2. Create Chat Session
  const sessionId = randomUUID();
  state.sessionIds.push(sessionId);
  const sessionStart = Date.now();
  const { error: sessionErr } = await supabase.from('chat_sessions').insert({
    id: sessionId,
    user_id: userId,
    title: `Load Test Session ${userIndex}`,
    session_type: 'thread',
    is_global: false,
  });
  state.latencies.push(Date.now() - sessionStart);
  
  if (sessionErr) {
    state.failedRequests++;
    return;
  }
  state.chatRequests++;

  // 3. Chat Messages (5 per user)
  for (let m = 0; m < MESSAGES_PER_USER; m++) {
    const msgStart = Date.now();
    
    if (MOCK_MODE) {
      // Mock mode: insert directly and publish event
      const msgId1 = randomUUID();
      const msgId2 = randomUUID();
      state.messageIds.push(msgId1, msgId2);
      
      await supabase.from('chat_messages').insert([
        { id: msgId1, session_id: sessionId, user_id: userId, role: 'user', content: `Test message ${m}` },
        { id: msgId2, session_id: sessionId, user_id: userId, role: 'assistant', content: `Mock reply ${m}` }
      ]);
      
      const { data: eventId, error: evtErr } = await supabase.rpc('create_event_with_consumers', {
        p_user_id: userId,
        p_type: 'CHAT_MESSAGE_PROCESSED',
        p_data: { sessionId, messageId: msgId2 },
        p_idempotency_key: `loadtest:chat:${sessionId}:${m}`,
        p_source: 'load_test',
        p_metadata: { isMock: true }
      });
      
      if (!evtErr && eventId) {
        state.eventIds.push(eventId);
        state.eventsCreated++;
      } else {
        state.failedRequests++;
      }
      
      state.latencies.push(Date.now() - msgStart);
      state.chatRequests++;
    } else {
      // Real HTTP request simulation (if we wanted to actually hit API)
      // Note: Full auth handshake is slow for 100 users, so we'll just simulate DB latency
      // For a true end-to-end, we would use fetch() with a JWT.
      state.failedRequests++;
      console.warn('Real HTTP testing not fully implemented in this script to prevent accidental DDoS/Quota burns. Use MOCK_MODE=true.');
      break;
    }
  }

  // 4. Practice Events
  if (PRACTICE_TEST) {
    const pStart = Date.now();
    const { data: eventId, error: evtErr } = await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: 'PRACTICE_ATTEMPT_RECORDED',
      p_data: { subject: 'Physics', score: Math.random() * 100 },
      p_idempotency_key: `loadtest:practice:${userId}`,
      p_source: 'load_test',
      p_metadata: { isMock: true }
    });
    
    if (!evtErr && eventId) {
      state.eventIds.push(eventId);
      state.eventsCreated++;
    }
    state.latencies.push(Date.now() - pStart);
  }
}

function calculatePercentile(latencies: number[], percentile: number) {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function run() {
  const runId = randomUUID().slice(0, 8);
  console.log(`Starting load generation for ${BETA_TEST_USERS} users...`);
  const startTime = Date.now();

  // Run in batches of 10 to avoid overwhelming connection pools locally
  const batchSize = 10;
  for (let i = 0; i < BETA_TEST_USERS; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, BETA_TEST_USERS - i) }, (_, k) => i + k);
    await Promise.all(batch.map(idx => simulateUserLoad(idx, runId)));
    process.stdout.write(`\rCreated ${Math.min(i + batchSize, BETA_TEST_USERS)}/${BETA_TEST_USERS} users...`);
  }
  console.log(`\n✅ Load generation complete in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

  // Allow some time for Queue to process
  console.log(`⏳ Waiting 5 seconds for Event Queue processing...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`📊 Fetching Queue Health...`);
  const [
    pending,
    processing,
    dlq,
    processedEvents,
  ] = await Promise.all([
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING').in('id', state.eventIds),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING').in('id', state.eventIds),
    supabase.from('event_dlq').select('*', { count: 'exact', head: true }).in('event_id', state.eventIds),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['COMPLETED']).in('id', state.eventIds),
  ]);

  const totalRequests = state.chatRequests + BETA_TEST_USERS; // sessions + chats
  const successRate = ((totalRequests - state.failedRequests) / totalRequests) * 100;
  
  const estimatedAiCalls = MOCK_MODE ? 0 : (BETA_TEST_USERS * MESSAGES_PER_USER);

  console.log(`\n==================================================`);
  console.log(`📈 TEST RESULTS REPORT`);
  console.log(`==================================================`);
  console.log(`Total Users Created:      ${state.usersCreated}`);
  console.log(`Total Chat Requests:      ${state.chatRequests}`);
  console.log(`Failed Requests:          ${state.failedRequests}`);
  console.log(`Success Rate:             ${successRate.toFixed(2)}%`);
  console.log(`p50 Latency:              ${calculatePercentile(state.latencies, 50)} ms`);
  console.log(`p95 Latency:              ${calculatePercentile(state.latencies, 95)} ms`);
  console.log(`--------------------------------------------------`);
  console.log(`Total Events Created:     ${state.eventsCreated}`);
  console.log(`Events Completed:         ${processedEvents.count || 0}`);
  console.log(`Queue Backlog (Pending):  ${pending.count || 0}`);
  console.log(`Queue Processing:         ${processing.count || 0}`);
  console.log(`DLQ Count (Failed):       ${dlq.count || 0}`);
  console.log(`--------------------------------------------------`);
  console.log(`Estimated AI Calls:       ${estimatedAiCalls}`);
  if (estimatedAiCalls > 0) {
    console.log(`⚠️ ESTIMATED COST WARNING: ${estimatedAiCalls} AI calls were made.`);
  } else {
    console.log(`✅ Safe Mode: No AI quota was consumed.`);
  }
  console.log(`==================================================\n`);

  if (state.failedRequests > 0 || (dlq.count || 0) > 0) {
    console.warn(`⚠️ Warning: There were failed requests or events in the DLQ.`);
  }

  // Wait a moment before cleanup to let output be read
  await cleanup();
}

run().catch(async (err) => {
  console.error('Fatal error during load test:', err);
  await cleanup();
  process.exit(1);
});
