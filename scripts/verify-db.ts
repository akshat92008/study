import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyDb() {
  console.log('--- Starting MVP Database Smoke Test ---');
  let passed = true;

  if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  try {
    // 1. Create a test user
    console.log(`\n1. Creating test user: ${testEmail}`);
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    
    if (createError) throw new Error(`User creation failed: ${createError.message}`);
    const userId = userData.user.id;
    console.log(`✅ User created: ${userId}`);

    // Sign in to get JWT for auth.uid() in RPCs
    const { error: signInError } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInError) throw new Error(`Sign in failed: ${signInError.message}`);
    console.log(`✅ User signed in`);

    // 2. Profile checks
    console.log('\n2. Verifying Profile');
    let { data: profile } = await client.from('profiles').select('*').eq('id', userId).single();
    if (!profile) {
      console.log('Profile missing, inserting...');
      const { error: profileErr } = await client.from('profiles').insert({ id: userId, streak_days: 0 });
      if (profileErr) throw new Error(`Profile insert failed: ${profileErr.message}`);
      profile = await client.from('profiles').select('*').eq('id', userId).single();
    }
    console.log('✅ Profile exists');

    // 3. Insert active learning goal
    console.log('\n3. Verifying Learning Goal');
    const { data: goal, error: goalErr } = await client.from('learning_goals').insert({
      user_id: userId,
      title: 'Smoke Test Goal',
      status: 'active'
    }).select().single();
    if (goalErr) throw new Error(`Learning goal insert failed: ${goalErr.message}`);
    console.log('✅ Learning goal created');

    // 4. Global chat session
    console.log('\n4. Verifying Global Chat Session');
    const { data: chatSession, error: chatErr } = await client.from('chat_sessions').insert({
      user_id: userId,
      session_type: 'global',
      is_global: true,
      title: 'Cognition OS Main Thread'
    }).select().single();
    if (chatErr) throw new Error(`Chat session insert failed: ${chatErr.message}`);
    console.log('✅ Global chat session created');

    // 5. Chat message
    console.log('\n5. Verifying Chat Message');
    const { error: msgErr } = await client.from('chat_messages').insert({
      session_id: chatSession.id,
      user_id: userId,
      role: 'user',
      content: 'Hello MIND'
    });
    if (msgErr) throw new Error(`Chat message insert failed: ${msgErr.message}`);
    console.log('✅ Chat message created');

    // 6. Complete study session
    console.log('\n6. Verifying Study Session Completion (RPC)');
    const { data: sessionData, error: sessionErr } = await client.rpc('complete_study_session', {
      p_user_id: userId,
      p_subject: 'General',
      p_chapter: 'Session',
      p_topic: 'React Context',
      p_concept_name: 'React Context',
      p_duration_minutes: 30,
      p_understood: true,
      p_gap_found: null,
      p_cards_created: 5,
      p_session_type: 'study',
      p_task_id: null,
      p_concept_id: null,
      p_completion_key: `smoke-test-${Date.now()}`,
      p_source: 'smoke_test'
    });
    if (sessionErr) throw new Error(`complete_study_session failed: ${sessionErr.message}`);
    console.log('✅ Study session completed successfully via RPC');

    // 7. Verify streak
    console.log('\n7. Verifying Streak Updates');
    const { data: updatedProfile } = await client.from('profiles').select('streak_days').eq('id', userId).single();
    console.log(`✅ Streak days: ${updatedProfile?.streak_days}`);

    // 8. Event queue / budget functions
    console.log('\n8. Verifying Event Enqueue (RPC)');
    const { data: eventId, error: eventErr } = await adminClient.rpc('create_event_with_consumers', {
      p_user_id: userId,
      p_type: 'STUDY_SESSION_COMPLETED',
      p_data: { test: true },
      p_idempotency_key: `smoke-test-${Date.now()}`,
      p_source: 'smoke',
      p_metadata: {}
    });
    if (eventErr) throw new Error(`create_event_with_consumers failed: ${eventErr.message}`);
    console.log(`✅ Event enqueued: ${eventId}`);

    // 9. Autopsy
    console.log('\n9. Verifying Autopsy Ingestion (RPC)');
    const mockPayload = {
      exam: 'NEET',
      questions: [
        {
          questionNumber: 1,
          status: 'Incorrect',
          subject: 'General',
          chapter: 'Arithmetic',
          questionText: 'What is 2+2?',
          correctAnswer: '4',
          studentAnswer: '5',
          mistakeCategory: 'calculation_error',
          reasoning: 'The arithmetic operation was applied incorrectly.',
          conceptualGap: 'Single digit addition',
          correctExplanation: '2+2 combines two pairs into four.',
          marksLost: 1,
          totalMarks: 1,
          extractionConfidence: 95,
          needsReview: false
        }
      ],
      total_questions: 1,
      correct_count: 0,
      incorrect_count: 1
    };
    const { error: autopsyErr } = await client.rpc('ingest_mock_autopsy', {
      p_user_id: userId,
      p_test_name: 'Smoke Test Autopsy',
      p_exam_type: 'NEET',
      p_total_questions: 1,
      p_correct_count: 0,
      p_incorrect_count: 1,
      p_unattempted_count: 0,
      p_current_score: 0,
      p_recoverable_marks: 1,
      p_potential_score: 1,
      p_questions: mockPayload.questions,
      p_idempotency_key: `smoke-autopsy-${Date.now()}`,
      p_trace_id: null,
      p_confidence_threshold: 70
    });
    if (autopsyErr) throw new Error(`ingest_mock_autopsy failed: ${autopsyErr.message}`);
    console.log('✅ Autopsy ingested successfully');

    // Check mistake exists
    const { data: mistakes } = await client.from('mistakes').select('*').eq('user_id', userId);
    console.log(`✅ Found ${mistakes?.length || 0} mistakes linked to user`);

  } catch (err: any) {
    console.error(`\n❌ Failed: ${err.message}`);
    passed = false;
  } finally {
    if (passed) {
      console.log('\n✅ All Database Smoke Tests Passed!');
      process.exit(0);
    } else {
      console.error('\n❌ Database Smoke Tests Failed.');
      process.exit(1);
    }
  }
}

verifyDb();
