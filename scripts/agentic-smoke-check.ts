import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createHash, randomUUID } from 'crypto';

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

type CleanupState = {
  userId?: string;
  eventIds: string[];
};

const cleanupState: CleanupState = { eventIds: [] };

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function logStep(label: string) {
  console.log(`\n${label}`);
}

function pass(message: string) {
  console.log(`PASS ${message}`);
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  throw new Error(message);
}

async function assertNoError<T = any>(label: string, result: { data: any; error: any }): Promise<T> {
  if (result.error) fail(`${label}: ${result.error.message}`);
  return result.data as T;
}

async function publishEvent(input: {
  userId: string;
  type: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
  source: string;
  metadata?: Record<string, unknown>;
}) {
  const eventId = await assertNoError(
    `publish ${input.type}`,
    await supabase.rpc('create_event_with_consumers', {
      p_user_id: input.userId,
      p_type: input.type,
      p_data: input.data,
      p_idempotency_key: input.idempotencyKey,
      p_source: input.source,
      p_metadata: { source: input.source, ...(input.metadata ?? {}) },
    })
  );
  if (typeof eventId === 'string' && !cleanupState.eventIds.includes(eventId)) {
    cleanupState.eventIds.push(eventId);
  }
  return eventId as string;
}

async function assertEventLocks(eventId: string, expectedConsumers: string[]) {
  const locks = await assertNoError(
    'load consumer locks',
    await supabase
      .from('consumer_locks')
      .select('consumer_name')
      .eq('event_id', eventId)
  );
  const actual = new Set((locks ?? []).map((lock: any) => lock.consumer_name));
  for (const consumer of expectedConsumers) {
    if (!actual.has(consumer)) {
      fail(`event ${eventId} missing consumer lock ${consumer}`);
    }
  }
  pass(`event ${eventId} has locks: ${expectedConsumers.join(', ')}`);
}

async function cleanup() {
  const userId = cleanupState.userId;
  console.log('\nCleanup');
  try {
    if (userId) {
      if (cleanupState.eventIds.length) {
        await supabase.from('consumer_locks').delete().in('event_id', cleanupState.eventIds);
        await supabase.from('event_attempts').delete().in('event_id', cleanupState.eventIds);
        await supabase.from('event_queue').delete().in('id', cleanupState.eventIds);
      }
      await supabase.from('message_citations').delete().eq('user_id', userId);
      await supabase.from('chat_messages').delete().eq('user_id', userId);
      await supabase.from('chat_sessions').delete().eq('user_id', userId);
      await supabase.from('mastery_evidence_ledger').delete().eq('user_id', userId);
      await supabase.from('mastery_events').delete().eq('user_id', userId);
      await supabase.from('revision_cards').delete().eq('user_id', userId);
      await supabase.from('study_material_chunks').delete().eq('user_id', userId);
      await supabase.from('rag_ingestion_jobs').delete().eq('user_id', userId);
      await supabase.from('study_materials').delete().eq('user_id', userId);
      await supabase.from('agent_action_approvals').delete().eq('user_id', userId);
      await supabase.from('agent_actions').delete().eq('user_id', userId);
      await supabase.from('agent_runs').delete().eq('user_id', userId);
      await supabase.from('concepts').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
      pass(`cleaned user ${userId}`);
    }
  } catch (error) {
    console.error('FAIL cleanup error', error);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('--- Agentic Runtime, RAG, AUTOPSY, ATLAS, MEMORY Smoke ---');

  const runId = randomUUID();
  const email = `agentic-smoke-${runId}@example.com`;

  try {
    logStep('1. Create isolated beta smoke user/profile');
    const auth = await assertNoError(
      'create auth user',
      await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
      })
    );
    if (!auth.user?.id) fail('create auth user: missing user id');
    const userId = auth.user.id;
    cleanupState.userId = userId;
    await assertNoError(
      'upsert profile',
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'Agentic Smoke',
        exam_type: 'neet',
        timezone: 'Asia/Kolkata',
      })
    );
    pass(`created user ${userId}`);

    logStep('2. Queue RAG material via canonical job + event path');
    const materialId = randomUUID();
    const contentHash = sha(`agentic-smoke-material:${runId}`);
    await assertNoError(
      'insert study_materials',
      await supabase.from('study_materials').insert({
        id: materialId,
        user_id: userId,
        title: 'Agentic Smoke Kinematics',
        original_filename: 'agentic-smoke.txt',
        mime_type: 'text/plain',
        storage_path: `${userId}/agentic-smoke.txt`,
        source_type: 'upload',
        status: 'uploaded',
        content_hash: contentHash,
        language: 'en',
      })
    );
    await assertNoError(
      'upsert rag_ingestion_jobs',
      await supabase.from('rag_ingestion_jobs').upsert({
        user_id: userId,
        material_id: materialId,
        status: 'queued',
        idempotency_key: `rag_ingestion:${userId}:${materialId}`,
        metadata: { smoke: true, mimeType: 'text/plain' },
      }, { onConflict: 'user_id,material_id,idempotency_key' })
    );
    const materialEventId = await publishEvent({
      userId,
      type: 'MATERIAL_UPLOADED',
      data: { materialId },
      idempotencyKey: `material_uploaded:${materialId}`,
      source: 'agentic_smoke',
    });
    await assertEventLocks(materialEventId, ['rag_agent']);
    pass('RAG upload is durable and worker-routed');

    logStep('3. Store a real chunk and citation for MIND/RAG grounding');
    const chunkId = randomUUID();
    await assertNoError(
      'insert study_material_chunks',
      await supabase.from('study_material_chunks').insert({
        id: chunkId,
        user_id: userId,
        material_id: materialId,
        chunk_index: 0,
        page_start: 1,
        page_end: 1,
        page_number: 1,
        heading: 'Kinematics',
        section_title: 'Kinematics',
        text: 'Velocity is the rate of change of displacement with respect to time.',
        content: 'Velocity is the rate of change of displacement with respect to time.',
        token_estimate: 18,
        char_count: 72,
        content_hash: sha(`chunk:${materialId}:0`),
        metadata: { smoke: true },
      })
    );
    const sessionId = randomUUID();
    const messageId = randomUUID();
    await assertNoError(
      'insert chat session',
      await supabase.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        title: 'Agentic Smoke Session',
        session_type: 'global',
      })
    );
    await assertNoError(
      'insert assistant message',
      await supabase.from('chat_messages').insert({
        id: messageId,
        session_id: sessionId,
        user_id: userId,
        role: 'assistant',
        content: 'Velocity comes from displacement over time. [Source 1]',
        idempotency_key: `agentic-smoke:${runId}:assistant`,
      })
    );
    await assertNoError(
      'upsert message citation',
      await supabase.from('message_citations').upsert({
        user_id: userId,
        message_id: messageId,
        material_id: materialId,
        chunk_id: chunkId,
        source_title: 'Agentic Smoke Kinematics',
        page_number: 1,
        section_title: 'Kinematics',
        quote: 'Velocity is the rate of change of displacement with respect to time.',
        relevance_score: 0.99,
        metadata: { smoke: true },
      }, { onConflict: 'user_id,message_id,chunk_id' })
    );
    pass('MIND citation references an actual user-owned chunk');

    logStep('4. Approve an AUTOPSY action and prove event idempotency');
    const conceptId = randomUUID();
    await assertNoError(
      'insert concept',
      await supabase.from('concepts').insert({
        id: conceptId,
        user_id: userId,
        name: 'Velocity Time Graphs',
        subject: 'Physics',
        chapter: 'Kinematics',
        topic: 'Velocity',
        mastery: 'developing',
        mastery_score: 35,
      })
    );
    const mistake = {
      status: 'verified_mistake',
      needsReview: false,
      extractionConfidence: 96,
      subject: 'Physics',
      chapter: 'Kinematics',
      mistakeCategory: 'conceptual_gap',
      reasoning: 'Confused slope of displacement-time graph with velocity-time graph area.',
      correctExplanation: 'Slope of displacement-time graph gives velocity; area under velocity-time graph gives displacement.',
      conceptualGap: 'velocity-time graph interpretation',
      sourceQuestionId: `agentic-smoke-question:${runId}`,
    };
    const actionId = randomUUID();
    const targetId = randomUUID();
    await assertNoError(
      'insert pending agent action',
      await supabase.from('agent_actions').insert({
        id: actionId,
        user_id: userId,
        agent_name: 'autopsy',
        action_type: 'uncertain_autopsy_mistake',
        target_type: 'autopsy_mistake',
        target_id: targetId,
        status: 'pending_approval',
        risk_level: 'requires_approval',
        approval_status: 'pending',
        confidence: 0.96,
        evidence: { mistake, wrongQuestions: [mistake] },
        idempotency_key: `autopsy_action:${userId}:${runId}`,
      })
    );
    await assertNoError(
      'record approval',
      await supabase.from('agent_action_approvals').upsert({
        action_id: actionId,
        user_id: userId,
        decision: 'approved',
        reason: 'Agentic smoke approval',
        decided_at: new Date().toISOString(),
      }, { onConflict: 'action_id,user_id' })
    );
    await assertNoError(
      'mark action approved',
      await supabase.from('agent_actions')
        .update({ status: 'approved', approval_status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', actionId)
        .eq('user_id', userId)
    );
    const approvedEventKey = `autopsy_mistake_approved:${actionId}`;
    const approvedEventId = await publishEvent({
      userId,
      type: 'AUTOPSY_MISTAKE_APPROVED',
      data: { actionId, targetId, mistake, wrongQuestions: [mistake] },
      idempotencyKey: approvedEventKey,
      source: 'agent_approval_api',
    });
    await publishEvent({
      userId,
      type: 'AUTOPSY_MISTAKE_APPROVED',
      data: { actionId, targetId, mistake, wrongQuestions: [mistake] },
      idempotencyKey: approvedEventKey,
      source: 'agent_approval_api',
    });
    const eventRows = await assertNoError(
      'count approved event rows',
      await supabase.from('event_queue').select('id', { count: 'exact' }).eq('idempotency_key', approvedEventKey)
    );
    if ((eventRows as any[]).length !== 1) fail('approval retry created duplicate AUTOPSY_MISTAKE_APPROVED events');
    await assertEventLocks(approvedEventId, ['atlas_agent', 'memory_agent', 'planner_agent']);
    pass('AUTOPSY approval is event-backed and idempotent');

    logStep('5. Verify ATLAS evidence and MEMORY idempotency surfaces');
    const masteryKey = `mastery_ledger:${userId}:${conceptId}:autopsy:${approvedEventId}:agentic-smoke`;
    await assertNoError(
      'insert mastery_evidence_ledger',
      await supabase.from('mastery_evidence_ledger').insert({
        user_id: userId,
        concept_id: conceptId,
        source_type: 'autopsy',
        source_id: actionId,
        source_event_id: approvedEventId,
        previous_mastery: 35,
        delta: -10,
        new_mastery: 25,
        confidence: 0.96,
        evidence: { mistake },
        reason: mistake.reasoning,
        idempotency_key: masteryKey,
      })
    );
    const normalizedKey = sha(`memory:${userId}:${conceptId}:${actionId}:${mistake.conceptualGap}`);
    const due = new Date().toISOString();
    await assertNoError(
      'insert revision card',
      await supabase.from('revision_cards').insert({
        user_id: userId,
        concept_id: conceptId,
        front: 'Explain the difference between slope and area on motion graphs.',
        back: mistake.correctExplanation,
        subject: 'Physics',
        chapter: 'Kinematics',
        due,
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        source_type: 'autopsy_mistake',
        source_id: actionId,
        normalized_key: normalizedKey,
        verified: true,
        confidence: 0.96,
        origin_event_id: approvedEventId,
      })
    );
    const duplicateCard = await supabase.from('revision_cards').insert({
      user_id: userId,
      concept_id: conceptId,
      front: 'Explain the difference between slope and area on motion graphs.',
      back: mistake.correctExplanation,
      subject: 'Physics',
      chapter: 'Kinematics',
      due,
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      source_type: 'autopsy_mistake',
      source_id: actionId,
      normalized_key: normalizedKey,
      verified: true,
      confidence: 0.96,
      origin_event_id: approvedEventId,
    });
    if (!duplicateCard.error) fail('duplicate MEMORY card insert unexpectedly succeeded');
    pass('ATLAS ledger writes and MEMORY duplicate guard are active');

    logStep('6. Verify agentic state summary data is queryable and user-scoped');
    const [{ count: pendingApprovals }, { count: recentActions }, { count: ragJobs }] = await Promise.all([
      supabase.from('agent_actions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('approval_status', 'pending'),
      supabase.from('agent_actions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('rag_ingestion_jobs').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    if ((pendingApprovals ?? 0) !== 0) fail('approved smoke action still appears pending');
    if ((recentActions ?? 0) < 1) fail('agent action summary has no actions');
    if ((ragJobs ?? 0) < 1) fail('RAG summary has no jobs');
    pass('state summary inputs are present and scoped');

    console.log('\nPASS Agentic smoke completed successfully.');
  } finally {
    await cleanup();
  }
}

run().catch(async (error) => {
  console.error('\nFAIL Agentic smoke failed.');
  console.error(error instanceof Error ? error.message : error);
  await cleanup();
  process.exit(1);
});
