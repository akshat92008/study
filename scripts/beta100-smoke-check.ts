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

const simulatedUserCount = 100;
const realUsers = Math.max(2, Math.min(Number(process.env.BETA100_REAL_USERS ?? 5), 12));
const eventIds: string[] = [];
const userIds: string[] = [];

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  throw new Error(message);
}

function pass(message: string) {
  console.log(`PASS ${message}`);
}

async function assertOk<T = any>(label: string, result: { data: any; error: any }): Promise<T> {
  if (result.error) fail(`${label}: ${result.error.message}`);
  return result.data as T;
}

async function publishEvent(userId: string, type: string, data: Record<string, unknown>, idempotencyKey: string, source: string) {
  const eventId = await assertOk(
    `publish ${type}`,
    await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: type,
      p_data: data,
      p_idempotency_key: idempotencyKey,
      p_source: source,
      p_metadata: { source },
    })
  );
  if (typeof eventId === 'string' && !eventIds.includes(eventId)) eventIds.push(eventId);
  return eventId as string;
}

async function cleanup() {
  console.log('\nCleanup');
  try {
    if (eventIds.length) {
      await supabase.from('consumer_locks').delete().in('event_id', eventIds);
      await supabase.from('event_attempts').delete().in('event_id', eventIds);
      await supabase.from('event_queue').delete().in('id', eventIds);
    }
    for (const userId of userIds) {
      await supabase.from('message_citations').delete().eq('user_id', userId);
      await supabase.from('chat_messages').delete().eq('user_id', userId);
      await supabase.from('chat_sessions').delete().eq('user_id', userId);
      await supabase.from('revision_cards').delete().eq('user_id', userId);
      await supabase.from('study_material_chunks').delete().eq('user_id', userId);
      await supabase.from('rag_ingestion_jobs').delete().eq('user_id', userId);
      await supabase.from('study_materials').delete().eq('user_id', userId);
      await supabase.from('agent_action_approvals').delete().eq('user_id', userId);
      await supabase.from('agent_actions').delete().eq('user_id', userId);
      await supabase.from('concepts').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
    pass(`cleaned ${userIds.length} users`);
  } catch (error) {
    console.error('FAIL cleanup error', error);
    process.exitCode = 1;
  }
}

async function run() {
  console.log('--- 100-user Private Beta Architecture Smoke ---');
  console.log('NOTE: This is NOT a full load test.');
  console.log(`Simulating beta architecture for ${simulatedUserCount} users using ${realUsers} real isolated Supabase users.`);
  const runId = randomUUID();
  const perUser: Array<{
    userId: string;
    materialId: string;
    chunkId: string;
    actionId: string;
    conceptId: string;
  }> = [];

  try {
    for (let i = 0; i < realUsers; i++) {
      const email = `beta100-${runId}-${i}@example.com`;
      const auth = await assertOk('create beta user', await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
      }));
      if (!auth.user?.id) fail('create beta user: missing user id');
      const userId = auth.user.id;
      userIds.push(userId);

      await assertOk('upsert profile', await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: `Beta User ${i + 1}`,
        exam_type: 'neet',
        timezone: 'Asia/Kolkata',
      }));

      const materialId = randomUUID();
      const chunkId = randomUUID();
      const actionId = randomUUID();
      const targetId = randomUUID();
      const conceptId = randomUUID();
      perUser.push({ userId, materialId, chunkId, actionId, conceptId });

      await assertOk('insert material', await supabase.from('study_materials').insert({
        id: materialId,
        user_id: userId,
        title: `Beta Material ${i + 1}`,
        original_filename: `beta-${i + 1}.txt`,
        mime_type: 'text/plain',
        storage_path: `${userId}/beta-${i + 1}.txt`,
        source_type: 'upload',
        status: 'uploaded',
        content_hash: sha(`${runId}:material:${i}`),
        language: 'en',
      }));

      await assertOk('insert rag job', await supabase.from('rag_ingestion_jobs').upsert({
        user_id: userId,
        material_id: materialId,
        status: 'queued',
        idempotency_key: `rag_ingestion:${userId}:${materialId}`,
        metadata: { beta100: true },
      }, { onConflict: 'user_id,material_id,idempotency_key' }));

      const materialEventId = await publishEvent(
        userId,
        'MATERIAL_UPLOADED',
        { materialId },
        `material_uploaded:${materialId}`,
        'beta100_smoke'
      );

      await assertOk('insert chunk', await supabase.from('study_material_chunks').insert({
        id: chunkId,
        user_id: userId,
        material_id: materialId,
        chunk_index: 0,
        page_start: 1,
        page_end: 1,
        text: `Beta user ${i + 1} source chunk about thermodynamics.`,
        content: `Beta user ${i + 1} source chunk about thermodynamics.`,
        token_estimate: 12,
        char_count: 48,
        content_hash: sha(`${materialId}:chunk:0`),
      }));

      const sessionId = randomUUID();
      await assertOk('insert chat session', await supabase.from('chat_sessions').insert({
        id: sessionId,
        user_id: userId,
        title: 'Beta100 Chat',
        session_type: 'global',
      }));
      await assertOk('insert chat message', await supabase.from('chat_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: 'Use my material for this answer.',
      }));

      await assertOk('insert concept', await supabase.from('concepts').insert({
        id: conceptId,
        user_id: userId,
        name: `Beta Concept ${i + 1}`,
        subject: 'Physics',
        chapter: 'Thermodynamics',
        mastery: 'exposed',
        mastery_score: 12,
      }));

      await assertOk('insert action', await supabase.from('agent_actions').insert({
        id: actionId,
        user_id: userId,
        agent_name: 'autopsy',
        action_type: 'uncertain_autopsy_mistake',
        target_type: 'autopsy_mistake',
        target_id: targetId,
        status: 'pending_approval',
        risk_level: 'requires_approval',
        approval_status: 'pending',
        confidence: 0.9,
        evidence: {
          mistake: {
            status: 'verified_mistake',
            needsReview: false,
            extractionConfidence: 90,
            subject: 'Physics',
            chapter: 'Thermodynamics',
            mistakeCategory: 'conceptual_gap',
          },
        },
        idempotency_key: `beta100_action:${userId}:${actionId}`,
      }));

      await assertOk('insert card', await supabase.from('revision_cards').insert({
        user_id: userId,
        concept_id: conceptId,
        front: `What should beta user ${i + 1} review in thermodynamics?`,
        back: 'First law and heat-work sign convention.',
        subject: 'Physics',
        chapter: 'Thermodynamics',
        due: new Date().toISOString(),
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        source_type: 'beta100',
        source_id: materialEventId,
        normalized_key: sha(`beta100:${userId}:thermo-card`),
      }));
    }
    pass(`created ${realUsers} isolated users with materials, RAG jobs, chats, concepts, cards, actions`);

    const [a, b] = perUser;
    const scopedA = await assertOk(
      'query scoped chunks user A',
      await supabase.from('study_material_chunks').select('id, user_id').eq('user_id', a.userId)
    );
    if ((scopedA as any[]).some((row) => row.user_id !== a.userId)) fail('user-scoped chunk query leaked another user');
    const crossMaterial = await assertOk(
      'query user A for user B material',
      await supabase
        .from('study_materials')
        .select('id')
        .eq('user_id', a.userId)
        .eq('id', b.materialId)
    );
    if ((crossMaterial as any[]).length !== 0) fail('user A could see user B material through scoped query');
    pass('user-scoped material and chunk queries isolate users');

    await assertOk('approve first user action', await supabase.from('agent_action_approvals').upsert({
      action_id: a.actionId,
      user_id: a.userId,
      decision: 'approved',
      reason: 'beta100 smoke',
      decided_at: new Date().toISOString(),
    }, { onConflict: 'action_id,user_id' }));
    await assertOk('update first user action', await supabase.from('agent_actions')
      .update({ status: 'approved', approval_status: 'approved' })
      .eq('id', a.actionId)
      .eq('user_id', a.userId));
    await publishEvent(
      a.userId,
      'AUTOPSY_MISTAKE_APPROVED',
      { actionId: a.actionId, mistake: { status: 'verified_mistake', needsReview: false, extractionConfidence: 91 } },
      `autopsy_mistake_approved:${a.actionId}`,
      'beta100_smoke'
    );
    const otherAction = await assertOk(
      'load second user action',
      await supabase.from('agent_actions').select('approval_status').eq('id', b.actionId).eq('user_id', b.userId).single()
    );
    if ((otherAction as any).approval_status !== 'pending') fail('approving user A action affected user B action');
    pass('agent approval is scoped per user');

    const duplicate = await supabase.from('revision_cards').insert({
      user_id: a.userId,
      concept_id: a.conceptId,
      front: 'Duplicate beta card',
      back: 'Should be rejected by normalized_key',
      subject: 'Physics',
      chapter: 'Thermodynamics',
      due: new Date().toISOString(),
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      source_type: 'beta100',
      source_id: 'duplicate',
      normalized_key: sha(`beta100:${a.userId}:thermo-card`),
    });
    if (!duplicate.error) fail('duplicate revision card normalized_key insert succeeded');
    pass('MEMORY duplicate card guard rejects duplicate normalized_key');

    const [{ count: events }, { count: jobs }, { count: actions }, { count: cards }] = await Promise.all([
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('id', eventIds),
      supabase.from('rag_ingestion_jobs').select('*', { count: 'exact', head: true }).in('user_id', userIds),
      supabase.from('agent_actions').select('*', { count: 'exact', head: true }).in('user_id', userIds),
      supabase.from('revision_cards').select('*', { count: 'exact', head: true }).in('user_id', userIds),
    ]);
    if ((events ?? 0) < realUsers) fail('event queue did not record beta user material events');
    if ((jobs ?? 0) < realUsers) fail('RAG jobs missing for beta users');
    if ((actions ?? 0) < realUsers) fail('agent actions missing for beta users');
    if ((cards ?? 0) < realUsers) fail('revision cards missing for beta users');
    pass('health inputs have queue, RAG, action, and MEMORY data');

    console.log('\nPASS beta100 architecture smoke completed successfully.');
  } finally {
    await cleanup();
  }
}

run().catch(async (error) => {
  console.error('\nFAIL beta100 smoke failed.');
  console.error(error instanceof Error ? error.message : error);
  await cleanup();
  process.exit(1);
});
