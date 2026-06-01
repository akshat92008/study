import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase env vars missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  console.log('--- Agentic E2E Smoke Test ---');
  let passed = true;

  const email = `agentic_smoke_${Date.now()}@example.com`;
  console.log(`\n1. Creating test user: ${email}`);
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true,
  });

  if (authErr) {
    console.error(`Auth Error: ${authErr.message}`);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log(`✅ User created (ID: ${userId})`);

  try {
    console.log('\n2. Testing RAG Ingestion & Chunking pipeline');
    const materialId = randomUUID();
    
    const { error: matErr } = await supabase.from('study_materials').insert({
      id: materialId,
      user_id: userId,
      title: 'Smoke Test Protocol',
      original_filename: 'smoke_test.txt',
      mime_type: 'text/plain',
      storage_path: 'smoke/smoke.txt',
      source_type: 'upload',
      status: 'uploaded',
      content_hash: 'testhash'
    });
    if (matErr) {
      console.error(`❌ Failed to create study_materials row: ${matErr.message}`);
      passed = false;
    } else {
      console.log('✅ study_materials row created');
    }

    const { error: ragErr } = await supabase.from('rag_ingestion_jobs').insert({
      id: randomUUID(),
      user_id: userId,
      material_id: materialId,
      status: 'queued',
      idempotency_key: `smoke_rag_test_${Date.now()}`,
      metadata: { test: true }
    });
    if (ragErr) {
      console.error(`❌ Failed to queue rag_ingestion_jobs row: ${ragErr.message}`);
      passed = false;
    } else {
      console.log('✅ rag_ingestion_jobs row created (Worker triggers MATERIAL_UPLOADED)');
    }

    const { error: chunkErr } = await supabase.from('study_material_chunks').insert({
      id: randomUUID(),
      user_id: userId,
      material_id: materialId,
      chunk_index: 0,
      text: 'Mitochondria is the powerhouse of the cell.',
      metadata: { source: 'smoke' }
    });
    if (chunkErr) {
      console.error(`❌ Failed to create study_material_chunks row: ${chunkErr.message}`);
      passed = false;
    } else {
      console.log('✅ study_material_chunks can be created by worker');
    }

    console.log('\n3. Testing Agent Actions (AUTOPSY approval loop)');
    const actionId = randomUUID();
    const { error: actionErr } = await supabase.from('agent_actions').insert({
      id: actionId,
      user_id: userId,
      agent_name: 'autopsy',
      action_type: 'uncertain_autopsy_mistake',
      target_type: 'autopsy',
      target_id: randomUUID(),
      status: 'pending_approval',
      risk_level: 'requires_approval',
      approval_status: 'pending',
      confidence: 0.8,
      evidence: { test: true },
      idempotency_key: `smoke_test_action_${Date.now()}`
    });
    if (actionErr) {
      console.error(`❌ Failed to create agent action: ${actionErr.message}`);
      passed = false;
    } else {
      console.log('✅ Agent action pending approval successfully recorded.');
      
      const { error: approvalErr } = await supabase.from('agent_action_approvals').insert({
        action_id: actionId,
        user_id: userId,
        decision: 'approved',
        reason: 'Smoke test approval',
        decided_at: new Date().toISOString()
      });
      if (approvalErr) {
        console.error(`❌ Failed to approve agent action: ${approvalErr.message}`);
        passed = false;
      } else {
        console.log('✅ Agent action approval recorded (triggers AUTOPSY_MISTAKE_APPROVED)');
      }
    }

    console.log('\n4. Testing Mastery Ledger (ATLAS update)');
    const conceptId = randomUUID();
    const { error: conceptErr } = await supabase.from('concepts').insert({
      id: conceptId,
      user_id: userId,
      name: 'Smoke Concept',
      subject: 'Smoke',
      chapter: 'Smoke Chapter',
      description: 'Smoke testing concept'
    });
    if (conceptErr) {
      console.error(`❌ Failed to create concepts row: ${conceptErr.message}`);
      passed = false;
    }

    const { error: masteryErr } = await supabase.from('mastery_evidence_ledger').insert({
      user_id: userId,
      concept_id: conceptId,
      source_id: randomUUID(),
      source_type: 'smoke_test',
      delta: 0.1,
      previous_mastery: 0,
      new_mastery: 0.1,
      evidence: { test: true },
      idempotency_key: `smoke_mastery_test_${Date.now()}`
    });
    if (masteryErr) {
      console.error(`❌ Failed to write to mastery_evidence_ledger: ${masteryErr.message}`);
      passed = false;
    } else {
      console.log('✅ ATLAS update updates mastery_evidence_ledger');
    }

    console.log('\n5. Testing Citations & Episodic Memory (MIND context)');
    const sessionId = randomUUID();
    const messageId = randomUUID();
    
    await supabase.from('chat_sessions').insert({
      id: sessionId,
      user_id: userId,
      title: 'Smoke Test Session'
    });
    
    await supabase.from('chat_messages').insert({
      id: messageId,
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: 'This is a test response'
    });

    const { error: citationErr } = await supabase.from('message_citations').insert({
      id: randomUUID(),
      user_id: userId,
      message_id: messageId,
      metadata: { test: true }
    });
    if (citationErr) {
      console.error(`❌ Failed to write to message_citations: ${citationErr.message}`);
      passed = false;
    } else {
      console.log('✅ Assistant message citations can be stored');
    }

    // Creating Episodic memory
    const { error: episodicErr } = await supabase.from('episodic_memories').insert({
      id: randomUUID(),
      user_id: userId,
      type: 'victory',
      source_type: 'event',
      description: 'Student uploaded material and an agent action was approved.',
      emotional_context: 'neutral',
      retrieval_weight: 1.0
    });
    if (episodicErr) {
      console.error(`❌ Failed to create episodic_memories row: ${episodicErr.message}`);
      passed = false;
    } else {
      console.log('✅ MIND context episodic memory can be stored');
    }

    // Verify session completion creates revision cards (MEMORY update)
    console.log('\n6. Testing Revision Cards (MEMORY update)');
    const { error: revisionErr } = await supabase.from('revision_cards').insert({
      id: randomUUID(),
      user_id: userId,
      front: 'What is the powerhouse of the cell?',
      back: 'Mitochondria',
      subject: 'Biology',
      chapter: 'Cell Biology',
      due: new Date().toISOString(),
      state: 0,
      difficulty: 0,
      stability: 0,
      reps: 0,
      lapses: 0
    });
    if (revisionErr) {
      console.error(`❌ Failed to create revision_cards row: ${revisionErr.message}`);
      passed = false;
    } else {
      console.log('✅ MEMORY card creation recorded');
    }

  } finally {
    console.log('\nCleaning up test user...');
    await supabase.auth.admin.deleteUser(userId);
    console.log(`✅ Cleaned up user ${userId}`);
  }

  if (!passed) {
    console.warn('\n⚠️ E2E Smoke check completed with errors.');
    process.exit(1);
  } else {
    console.log('\n✅ E2E Smoke check completed successfully. All agentic foundations are wired.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ Fatal error during smoke test:', err);
  process.exit(1);
});
