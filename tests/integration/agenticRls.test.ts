import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // use anon key for RLS testing

describe('Agentic Runtime True RLS', () => {
  let adminClient: any;
  let userA: any;
  let userB: any;
  let clientA: any;
  let clientB: any;

  beforeAll(async () => {
    adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailA = `rls_agentic_a_${Date.now()}@example.com`;
    const emailB = `rls_agentic_b_${Date.now()}@example.com`;
    
    const { data: authDataA } = await adminClient.auth.admin.createUser({
      email: emailA, password: 'password123', email_confirm: true,
    });
    userA = authDataA.user;

    const { data: authDataB } = await adminClient.auth.admin.createUser({
      email: emailB, password: 'password123', email_confirm: true,
    });
    userB = authDataB.user;

    clientA = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});
    await clientA.auth.signInWithPassword({ email: emailA, password: 'password123' });

    clientB = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});
    await clientB.auth.signInWithPassword({ email: emailB, password: 'password123' });
    
    // Seed some data as admin for user B
    const materialId = randomUUID();
    await adminClient.from('study_materials').insert({
      id: materialId, user_id: userB.id, title: 'B Material', original_filename: 'b.txt',
      mime_type: 'text/plain', storage_path: 'b/b.txt', source_type: 'upload', status: 'uploaded',
      content_hash: `hash-b-${Date.now()}`
    });

    await adminClient.from('study_material_chunks').insert({
      id: randomUUID(), user_id: userB.id, material_id: materialId, chunk_index: 0,
      page_start: 1, page_end: 1, text: 'text', content: 'content',
      token_estimate: 1, char_count: 4, content_hash: `hash-chunk-b-${Date.now()}`
    });

    const actionId = randomUUID();
    await adminClient.from('agent_actions').insert({
      id: actionId, user_id: userB.id, agent_name: 'autopsy', action_type: 'uncertain_autopsy_mistake',
      target_type: 'test', status: 'pending_approval', risk_level: 'requires_approval',
      approval_status: 'pending', idempotency_key: `action-b-${Date.now()}`
    });
    
    await adminClient.from('message_citations').insert({
      id: randomUUID(), user_id: userB.id, message_id: randomUUID(), chunk_id: randomUUID(),
      relevance_score: 1.0, idempotency_key: `cite-b-${Date.now()}`
    });
    
    await adminClient.from('concepts').insert({
      id: randomUUID(), user_id: userB.id, name: 'B Concept', subject: 'B Subject',
      chapter: 'B Chapter', topic: 'B Topic'
    });
    
    await adminClient.from('mastery_evidence_ledger').insert({
      id: randomUUID(), user_id: userB.id, concept_id: randomUUID(), source_id: randomUUID(),
      source_type: 'test', delta: 0.1, previous_mastery: 0.1, new_mastery: 0.2, evidence: {},
      idempotency_key: `mastery-b-${Date.now()}`
    });
  });

  afterAll(async () => {
    if (userA) await adminClient.auth.admin.deleteUser(userA.id);
    if (userB) await adminClient.auth.admin.deleteUser(userB.id);
  });

  it('user A cannot read user B study_materials', async () => {
    const { data } = await clientA.from('study_materials').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B study_material_chunks', async () => {
    const { data } = await clientA.from('study_material_chunks').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B agent_actions', async () => {
    const { data } = await clientA.from('agent_actions').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot approve user B action', async () => {
    const { error } = await clientA.from('agent_action_approvals').insert({
      action_id: randomUUID(), user_id: userB.id, decision: 'approved', decided_at: new Date().toISOString()
    });
    expect(error).not.toBeNull();
  });

  it('user A cannot read user B message_citations', async () => {
    const { data } = await clientA.from('message_citations').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });

  it('user A cannot read user B mastery_evidence_ledger', async () => {
    const { data } = await clientA.from('mastery_evidence_ledger').select('*').eq('user_id', userB.id);
    expect(data).toHaveLength(0);
  });
});
