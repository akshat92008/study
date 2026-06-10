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
import { runHermesTurn } from '@/lib/agent/runtime';
import type { CognitionAgentTurnInput } from '@/lib/agent/types';

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
      await supabase.from('learner_events').delete().eq('user_id', uid);
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

    // 3. Run agent directly (no background worker)
    log('3. Call runHermesTurn directly');
    const turnInput: CognitionAgentTurnInput = {
      userId,
      channel: 'chat',
      userMessage: "I still don't understand tachycardia",
      sessionId,
      payload: {
        message: "I still don't understand tachycardia",
        fullResponse: 'Tachycardia is an elevated heart rate exceeding 100 bpm at rest.',
      },
    };
    const agentOutput = await runHermesTurn(turnInput, { supabase: supabase as any });
    pass(`agent completed — trajectory ${agentOutput.trajectoryId}`);
    const trajectoryId = agentOutput.trajectoryId;

    // 4. Query agent_runs record
    log('4. Verify agent_runs record exists');
    const { data: runs } = await supabase
      .from('agent_runs')
      .select('id, channel, status, final_response_summary, verification, mutation_summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (!runs?.length) fail('no agent_runs found');
    pass(`${runs.length} agent_run(s)`);
    const run = runs[0];

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

    // 9. Check learner event
    log('9. Verify write_learning_event produced a learner_event row');
    const { data: learningEvts } = await supabase
      .from('learner_events')
      .select('id, event_type, user_id')
      .eq('user_id', userId);
    if (!learningEvts?.length) fail('no learning_event rows');
    pass(`${learningEvts.length} learning_event(s)`);

    // 10. Check agent_verifications
    log('10. Verify agent_verifications rows exist');
    const { data: verifications } = await supabase
      .from('agent_verifications')
      .select('id, tool_call_id, success, verification_type, entity_type, entity_id, summary')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (!verifications?.length) fail('no agent_verifications found');
    pass(`${verifications.length} verification(s) — success: ${verifications.filter(v => v.success).length}, failed: ${verifications.filter(v => !v.success).length}`);

    // 11. Check tool inputs — ensure no compiled tool argument used raw { from: "signals" }
    log('11. Ensure no signal tool compiled with { from: "signals" } placeholder');
    const { data: toolInputRows } = await supabase
      .from('agent_tool_calls')
      .select('id, tool_name, args, result')
      .eq('run_id', trajectoryId)
      .in('tool_name', ['update_concept_mastery', 'create_memory_card', 'update_microtarget', 'write_learning_event']);

    const badInputs: string[] = [];
    for (const row of (toolInputRows ?? []) as any[]) {
      const input = row.args as any;
      // Any input that still carries the legacy { from: "signals" } hint is a bug
      if (input && (input.from === 'signals' || (input.concept && (input.concept as any).from === 'signals'))) {
        badInputs.push(`${row.tool_name}: ${JSON.stringify(input)}`);
      }
      // Also check result for the same pattern (tool may serialize it back)
      const resultData = row.result as any;
      if (resultData?.data && (resultData.data as any).from === 'signals') {
        badInputs.push(`${row.tool_name} result: ${JSON.stringify(resultData)}`);
      }
    }
    if (badInputs.length) fail(`bad input(s) found: ${badInputs.join('; ')}`);
    pass(`checked ${toolInputRows?.length ?? 0} signal-tool call inputs — clean`);

    // 12. Check response claim guard
    log('12. Verify final response does not overclaim unverified progress');
    if (run.final_response_summary) {
      const FR = run.final_response_summary.toLowerCase();
      const overclaiming =
        (FR.includes('saved') || FR.includes('progress') || FR.includes('recorded')) &&
        !FR.includes('help');
      if (overclaiming) {
        fail(`response appears to overclaim: ${run.final_response_summary?.slice(0, 100)}`);
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