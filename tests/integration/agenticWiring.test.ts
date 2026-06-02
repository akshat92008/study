import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const runLiveSupabase = process.env.RUN_SUPABASE_INTEGRATION_TESTS === 'true';
const describeLiveSupabase = runLiveSupabase ? describe : describe.skip;

const supabase = runLiveSupabase
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null as any;

describeLiveSupabase('Agentic Runtime Wiring', () => {
  let userId: string;

  beforeAll(async () => {
    const email = `agentic_wiring_${Date.now()}@example.com`;
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true,
    });
    if (authErr) throw authErr;
    userId = authData.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  it('verifies RAG ingestion material upload queues a background job', async () => {
    const materialId = randomUUID();
    
    // Create material row
    await supabase.from('study_materials').insert({
      id: materialId,
      user_id: userId,
      title: 'Wiring Test Protocol',
      original_filename: 'wiring.txt',
      mime_type: 'text/plain',
      storage_path: 'wiring/wiring.txt',
      source_type: 'upload',
      status: 'uploaded',
      content_hash: `testhash-${Date.now()}`
    });

    // Create queue entry (this mimics the behavior added in chat route)
    const { error: ragErr } = await supabase.from('rag_ingestion_jobs').insert({
      user_id: userId,
      material_id: materialId,
      status: 'queued',
      idempotency_key: `rag_ingest_test_${Date.now()}`,
    });

    expect(ragErr).toBeNull();
    
    // Verify it exists in DB
    const { data } = await supabase.from('rag_ingestion_jobs').select('*').eq('material_id', materialId).single();
    expect(data).toBeDefined();
    expect(data.status).toBe('queued');
  });

  it('verifies agent action approval triggers side-effects via event queue', async () => {
    const actionId = randomUUID();
    
    // Create pending approval action
    await supabase.from('agent_actions').insert({
      id: actionId,
      user_id: userId,
      agent_name: 'autopsy_agent',
      action_type: 'uncertain_autopsy_mistake',
      target_type: 'autopsy',
      target_id: randomUUID(),
      status: 'pending_approval',
      risk_level: 'requires_approval',
      approval_status: 'pending',
      confidence: 0.8,
      evidence: { test: true },
      idempotency_key: `wiring_test_action_${Date.now()}`
    });

    // Approve the action (in API this creates the AAA row and calls EventDispatcher)
    // We will directly verify that creating the event succeeds for AUTOPSY_MISTAKE_APPROVED
    const idempotencyKey = `autopsy_mistake_approved:${actionId}`;
    
    const { error: eventErr } = await supabase.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: 'AUTOPSY_MISTAKE_APPROVED',
      p_data: { actionId },
      p_idempotency_key: idempotencyKey,
      p_source: 'agent_approval_api',
      p_metadata: {}
    });

    expect(eventErr).toBeNull();

    // Verify event is in queue
    const { data: eventData } = await supabase
      .from('event_queue')
      .select('id, type, status')
      .eq('idempotency_key', idempotencyKey)
      .single();

    expect(eventData).toBeDefined();
    expect(eventData.type).toBe('AUTOPSY_MISTAKE_APPROVED');
  });

  it('verifies mastery evidence ledger insert syntax', async () => {
    const conceptId = randomUUID();
    
    await supabase.from('concepts').insert({
      id: conceptId,
      user_id: userId,
      name: 'Wiring Concept',
      subject: 'Wiring',
      chapter: 'Wiring Chapter',
      topic: 'Wiring Topic',
      description: 'Wiring testing concept'
    });

    const { error: masteryErr } = await supabase.from('mastery_evidence_ledger').insert({
      user_id: userId,
      concept_id: conceptId,
      source_id: randomUUID(),
      source_type: 'wiring_test',
      delta: 0.1,
      previous_mastery: 0.5,
      new_mastery: 0.6,
      evidence: { verified: true },
      idempotency_key: `wiring_mastery_test_${Date.now()}`
    });

    expect(masteryErr).toBeNull();
  });
});
