import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const describeLiveSupabase = describe;

describeLiveSupabase('Agentic Runtime True RLS', () => {
  let adminClient: any;
  let userA: any;
  let userB: any;
  let clientA: any;
  let clientB: any;
  let unauthClient: any;

  // Track IDs for User B
  const idsB = {
    materialId: randomUUID(),
    chunkId: randomUUID(),
    actionId: randomUUID(),
    messageId: randomUUID(),
    citationId: randomUUID(),
    conceptId: randomUUID(),
    masteryId: randomUUID(),
    ragJobKey: randomUUID(),
    revisionCardId: randomUUID(),
  };

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailA = `rls_agentic_a_${Date.now()}@example.com`;
    const emailB = `rls_agentic_b_${Date.now()}@example.com`;
    
    const { data: authDataA, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA, password: 'password123', email_confirm: true,
    });
    expect(errA).toBeNull();
    userA = authDataA.user;

    const { data: authDataB, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB, password: 'password123', email_confirm: true,
    });
    expect(errB).toBeNull();
    userB = authDataB.user;

    clientA = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});
    await clientA.auth.signInWithPassword({ email: emailA, password: 'password123' });

    clientB = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});
    await clientB.auth.signInWithPassword({ email: emailB, password: 'password123' });

    unauthClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});

    // Seed data as admin for user B
    const materialRes = await adminClient.from('study_materials').insert({
      id: idsB.materialId, user_id: userB.id, title: 'B Material', original_filename: 'b.txt',
      mime_type: 'text/plain', storage_path: 'b/b.txt', source_type: 'upload', status: 'uploaded',
      content_hash: `hash-b-${Date.now()}`
    });
    expect(materialRes.error).toBeNull();

    const chunkRes = await adminClient.from('study_material_chunks').insert({
      id: idsB.chunkId, user_id: userB.id, material_id: idsB.materialId, chunk_index: 0,
      page_start: 1, page_end: 1, text: 'text', content: 'content',
      token_estimate: 1, char_count: 4, content_hash: `hash-chunk-b-${Date.now()}`
    });
    expect(chunkRes.error).toBeNull();

    const ragRes = await adminClient.from('rag_ingestion_jobs').insert({
      user_id: userB.id, material_id: idsB.materialId, status: 'queued',
      idempotency_key: idsB.ragJobKey
    });
    expect(ragRes.error).toBeNull();

    const actionRes = await adminClient.from('agent_actions').insert({
      id: idsB.actionId, user_id: userB.id, agent_name: 'autopsy', action_type: 'uncertain_autopsy_mistake',
      target_type: 'test', status: 'pending_approval', risk_level: 'requires_approval',
      approval_status: 'pending', idempotency_key: `action-b-${Date.now()}`
    });
    expect(actionRes.error).toBeNull();
    
    const conceptRes = await adminClient.from('concepts').insert({
      id: idsB.conceptId, user_id: userB.id, name: 'B Concept', subject: 'B Subject',
      chapter: 'B Chapter', topic: 'B Topic'
    });
    expect(conceptRes.error).toBeNull();
    
    const masteryRes = await adminClient.from('mastery_evidence_ledger').insert({
      id: idsB.masteryId, user_id: userB.id, concept_id: idsB.conceptId, source_id: randomUUID(),
      source_type: 'test', delta: 0.1, previous_mastery: 0.1, new_mastery: 0.2, evidence: {},
      idempotency_key: `mastery-b-${Date.now()}`
    });
    expect(masteryRes.error).toBeNull();

    const cardRes = await adminClient.from('revision_cards').insert({
      user_id: userB.id, concept_id: idsB.conceptId, front: 'front', back: 'back',
      subject: 'sub', chapter: 'chap', due: new Date().toISOString(),
      stability: 0, difficulty: 0, reps: 0, lapses: 0, state: 0,
      source_type: 'test', source_id: randomUUID(), normalized_key: `card-b-${Date.now()}`
    });
    expect(cardRes.error).toBeNull();
  });

  afterAll(async () => {
    if (userA) await adminClient.auth.admin.deleteUser(userA.id);
    if (userB) await adminClient.auth.admin.deleteUser(userB.id);
  });

  // Verify User B can read own data
  it('user B can read own study_materials', async () => {
    const { data } = await clientB.from('study_materials').select('*').eq('user_id', userB.id);
    expect(data?.length).toBeGreaterThan(0);
  });

  it('user B can read own agent_actions', async () => {
    const { data } = await clientB.from('agent_actions').select('*').eq('id', idsB.actionId);
    expect(data?.length).toBe(1);
  });

  // Verify User A cannot read User B data
  it('user A cannot read user B study_materials', async () => {
    const { data } = await clientA.from('study_materials').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B study_material_chunks', async () => {
    const { data } = await clientA.from('study_material_chunks').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot retrieve user B RAG jobs', async () => {
    const { data } = await clientA.from('rag_ingestion_jobs').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B agent_actions', async () => {
    const { data } = await clientA.from('agent_actions').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot approve user B action', async () => {
    const { error } = await clientA.from('agent_action_approvals').insert({
      action_id: idsB.actionId, user_id: userB.id, decision: 'approved', decided_at: new Date().toISOString()
    });
    expect(error).not.toBeNull();
  });

  it('user A cannot read user B concepts', async () => {
    const { data } = await clientA.from('concepts').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B mastery_evidence_ledger', async () => {
    const { data } = await clientA.from('mastery_evidence_ledger').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B revision_cards', async () => {
    const { data } = await clientA.from('revision_cards').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  // Unauthenticated checks
  it('unauthenticated client cannot read private rows', async () => {
    const [
      materials,
      chunks,
      actions,
      ragJobs,
      cards
    ] = await Promise.all([
      unauthClient.from('study_materials').select('*'),
      unauthClient.from('study_material_chunks').select('*'),
      unauthClient.from('agent_actions').select('*'),
      unauthClient.from('rag_ingestion_jobs').select('*'),
      unauthClient.from('revision_cards').select('*')
    ]);

    expect(materials.data).toHaveLength(0);
    expect(chunks.data).toHaveLength(0);
    expect(actions.data).toHaveLength(0);
    expect(ragJobs.data).toHaveLength(0);
    expect(cards.data).toHaveLength(0);
  });
});
