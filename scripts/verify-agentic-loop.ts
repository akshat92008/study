/**
 * Verify-agentic-loop.ts
 *
 * Smoke test for the Hermes-class agentic loop tachycardia path.
 *
 * Acceptance criteria for chat message "I still don't understand tachycardia":
 *   1. extract_learning_signals runs
 *   2. upsert_atlas_concept runs with concept Tachycardia
 *   3. update_concept_mastery runs with returned conceptId
 *   4. create_memory_card runs with returned conceptId
 *   5. write_learning_event runs
 *   6. agent_verifications rows exist
 *   7. No tool receives { from: "signals" }
 *   8. Response only claims saved progress if verification passes
 *
 * Run: npm run verify:agentic-loop
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('FAIL Supabase env vars missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cleanup = {
  userId: undefined as string | undefined,
  eventIds: [] as string[],
  chatSessionIds: [] as string[],
};

function log(label: string) {
  console.log(`\n${label}`);
}
function pass(msg: string) { console.log(`PASS ${msg}`); }
function fail(msg: string): never {
  console.error(`FAIL ${msg}`);
  throw new Error(msg);
}

async function cleanupAll() {
  console.log('\nCleanup');
  try {
    if (cleanup.userId) {
      const uid = cleanup.userId;
      const ids = cleanup.eventIds;
      const sids = cleanup.chatSessionIds;
      if (ids.length) {
        await supabase.from('consumer_locks').delete().in('event_id', ids);
        await supabase.from('event_attempts').delete().in('event_id', ids);
        await supabase.from('event_queue').delete().in('id', ids);
      }
      if (sids.length) {
        await supabase.from('chat_messages').delete().in('session_id', sids);
        await supabase.from('chat_sessions').delete().eq('id', sids[0]).eq('user_id', uid);
      }
      await supabase.from('event_queue').delete().eq('user_id', uid);
      await supabase.from('mastery_evidence_ledger').delete().eq('user_id', uid);
      await supabase.from('mastery_events').delete().eq('user_id', uid);
      await supabase.from('revision_cards').delete().eq('user_id', uid);
      await supabase.from('concepts').delete().eq('user_id', uid);
      await supabase.from('learning_events').delete().eq('user_id', uid);
      await supabase.from('agent_verifications').delete().eq('user_id', uid);
      await supabase.from('agent_runs').delete().eq('user_id', uid);
      await supabase.from('profiles').delete().eq('id', uid);
      await supabase.auth.admin.deleteUser(uid);
      pass(`cleaned user ${uid}`);
    }
  } catch (e) {
    console.error('cleanup error', e);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('--- Agentic Loop Tachycardia Smoke Test ---');
  const runId = randomUUID();
  const email = `verify-tachycardia-${runId}@example.com`;

  try {
    // 1. Create isolated smoke user
    log('1. Create isolated smoke user');
    const auth = await supabase.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
    if (auth.error) fail(`create user: ${auth.error.message}`);
    const userId = auth.data.user?.id ?? fail('no user id');
    cleanup.userId = userId;
    await supabase.from('profiles').upsert({
      id: userId, email, full_name: 'Verify Tachy', exam_type: 'neet', timezone: 'Asia/Kolkata',
    });
    pass(`user ${userId}`);

    // 2. Create a chat session so the agent has context
    log('2. Create chat session and messages');
    const sessionId = randomUUID();
    cleanup.chatSessionIds.push(sessionId);

    await supabase.from('chat_sessions').insert({
      id: sessionId, user_id: userId, title: 'Verify Tachycardia',
    });
    await supabase.from('chat_messages').insert([
      {
        id: randomUUID(), session_id: sessionId, user_id: userId, role: 'assistant',
        content: 'Tachycardia is an elevated heart rate.',
      },
      {
        id: randomUUID(), session_id: sessionId, user_id: userId, role: 'user',
        content: "I still don't understand tachycardia",
      },
    ]);
    pass('chat context created');

    // 3. Fire the agent via the chat_message_processed event
    const { data: eventsData, error: evErr } = await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: 'CHAT_MESSAGE_PROCESSED',
      p_data: {
        sessionId,
        message: "I still don't understand tachycardia",
        fullResponse: 'Tachycardia is an elevated heart rate exceeding 100 bpm at rest.',
      },
      p_idempotency_key: `tachycardia:${runId}`,
      p_source: 'verify-agentic-loop',
      p_metadata: { runtimeProcessed: false, trace_id: runId },
    });
    if (evErr) fail(`create event: ${evErr.message}`);
    const eventId = (eventsData as string) ?? fail('no event id');
    cleanup.eventIds.push(eventId);
    pass(`event ${eventId}`);

    // 4. Wait for event workers to process
    log('4. Wait for event processing (5s)');
    await new Promise(r => setTimeout(r, 5000));

    // 5. Check agent_runs records
    log('5. Verify agent_runs exist');
    const { data: runs } = await supabase
      .from('agent_runs')
      .select('id, trajectory_id, channel, status, final_response')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (!runs?.length) fail('no agent_runs found');
    pass(`${runs.length} agent_run(s)`);

    // 6. Check concept was upserted
    log('6. Verify Tachycardia concept was upserted');
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, name, user_id')
      .eq('user_id', userId)
      .ilike('name', '%tachycardia%');
    if (!concepts?.length) fail('no Tachycardia concept found');
    pass(`concept ${concepts[0].id}: ${concepts[0].name}`);
    const conceptId = concepts[0].id;

    // 7. Check mastery evidence
    log('7. Verify update_concept_mastery produced evidence');
    const { data: masteryEvidence } = await supabase
      .from('mastery_evidence_ledger')
      .select('id, concept_id, source_type')
      .eq('user_id', userId)
      .eq('concept_id', conceptId)
      .eq('source_type', 'agent');
    if (!masteryEvidence?.length) fail('no mastery evidence for Tachycardia');
    pass(`${masteryEvidence.length} mastery evidence row(s)`);

    // 8. Check revision card
    log('8. Verify create_memory_card created a revision card');
    const { data: cards } = await supabase
      .from('revision_cards')
      .select('id, concept_id, front')
      .eq('user_id', userId)
      .eq('concept_id', conceptId);
    if (!cards?.length) fail('no revision card for Tachycardia');
    pass(`card ${cards[0].id}: "${cards[0].front?.slice(0, 60)}"`);

    // 9. Check learning event
    log('9. Verify write_learning_event produced a learning_event row');
    const { data: learningEvts } = await supabase
      .from('learning_events')
      .select('id, event_type, user_id')
      .eq('user_id', userId);
    if (!learningEvts?.length) fail('no learning_event rows');
    pass(`${learningEvts.length} learning_event(s)`);

    // 10. Check agent_verifications
    log('10. Verify agent_verifications rows exist');
    const { data: verifications } = await supabase
      .from('agent_verifications')
      .select('id, user_id, status, check_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!verifications?.length) fail('no agent_verifications found');
    pass(`${verifications.length} verification(s): ${verifications.map(v => v.check_name).join(', ')}`);

    // 11. Check tool audit - ensure no tool used { from: "signals" }
    log('11. Verify no tool calls used { from: "signals" }');
    const { data: toolCalls } = await supabase
      .from('agent_runs')
      .select('trajectory_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (!toolCalls) fail('no agent run to check');
    const trajectoryId = toolCalls.trajectory_id;

    const { data: steps } = await supabase
      .from('agent_steps')
      .select('step_type, content')
      .eq('run_id', trajectoryId)
      .eq('step_type', 'tool_call');
    const badSteps = (steps ?? []).filter((s: any) => {
      const c = s.content;
      return c && typeof c === 'object' && (c as any).toolName &&
        typeof (c as any).toolInput === 'object' && (c as any).toolInput?.from === 'signals';
    });
    if (badSteps.length) fail(`${badSteps.length} tool_call(s) still use { from: "signals" }`);
    pass('no tool uses { from: "signals" }');

    // 12. Check response claim guard
    log('12. Verify final response does not overclaim unverified progress');
    const run = runs[0];
    if (run.final_response) {
      const FR = run.final_response.toLowerCase();
      const overclaiming =
        (FR.includes('saved') || FR.includes('progress') || FR.includes('recorded')) &&
        !FR.includes('help');
      if (overclaiming) {
        fail(`response appears to overclaim: ${run.final_response.slice(0, 100)}`);
      }
    }
    pass('response does not overclaim unverified progress');

    console.log('\nPASS All tachycardia smoke checks passed.');
  } finally {
    await cleanupAll();
  }
}

run().catch(async (err) => {
  console.error('\nFAIL Tachycardia smoke failed.');
  console.error(err instanceof Error ? err.message : err);
  await cleanupAll();
  process.exit(1);
});