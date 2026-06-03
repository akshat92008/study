import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testGoalCreation() {
  console.log('Testing goal creation...');
  
  // 1. Get a user
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !users || users.users.length === 0) {
    console.error('Failed to get user:', userError);
    return;
  }
  const userId = users.users[0].id;
  console.log(`Using user ID: ${userId}`);

  // 2. Simulate /api/goals/route.ts insert
  const title = 'Test Goal';
  const metadata = {
    currentLevel: 'beginner',
    timeAvailable: 8,
    preferredLearningStyle: 'read_write',
  };

  const GOAL_SELECT =
  'id, user_id, title, subject, domain, exam_type, target_level, description, target_date, progress, status, primary_chat_session_id, last_active_at, metadata, created_at, updated_at';

  console.log('Inserting goal...');
  const { data: goal, error: goalError } = await supabase
    .from('learning_goals')
    .insert({
      user_id: userId,
      title,
      subject: 'Physics',
      domain: null,
      exam_type: null,
      target_level: 'NEET',
      description: null,
      target_date: '2025-05-15',
      progress: 0,
      status: 'active',
      last_active_at: new Date().toISOString(),
      metadata,
    })
    .select(GOAL_SELECT)
    .single();

  if (goalError) {
    console.error('Error inserting goal:', goalError);
    return;
  }
  
  console.log('Goal inserted successfully:', goal.id);

  // 3. Simulate getOrCreatePrimaryGoalSession
  const sessionTitle = `${goal.title} AI Tutor`;
  console.log('Inserting chat session...');
  const { data: createdSession, error: createError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title: sessionTitle,
      session_type: 'goal',
      is_global: false,
      goal_id: goal.id,
      is_primary_for_goal: true,
    })
    .select('id')
    .single();

  if (createError) {
    console.error('Error inserting session:', createError);
    return;
  }

  console.log('Session inserted successfully:', createdSession.id);

  console.log('Updating goal with session id...');
  const { error: updateError } = await supabase
    .from('learning_goals')
    .update({
      primary_chat_session_id: createdSession.id,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', goal.id)
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error updating goal:', updateError);
    return;
  }

  console.log('Goal updated successfully!');
}

testGoalCreation().catch(console.error);
