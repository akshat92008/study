import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function debugUser() {
  const userId = process.env.USER_ID || process.argv[2];

  if (!userId) {
    console.error('❌ Please provide USER_ID as an argument or env var.');
    console.error('Usage: npm run debug:user <USER_ID>');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase env vars missing.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`--- Debugging MVP State for User: ${userId} ---\n`);

  // 1. Profile
  const { data: profile } = await supabase.from('profiles').select('exam, current_streak, last_active_date').eq('id', userId).single();
  console.log('Profile:', profile || 'Not found');

  // 2. Active Learning Goal
  const { data: goal } = await supabase.from('study_goals').select('title, status, progress').eq('user_id', userId).eq('status', 'active').single();
  console.log('Active Learning Goal:', goal || 'None');

  // 3. Today Session Card (study_tasks)
  const today = new Date().toISOString().split('T')[0];
  const { data: sessionCard } = await supabase.from('study_tasks').select('title, is_completed').eq('user_id', userId).eq('scheduled_date', today).limit(1).single();
  console.log('Today Session Card:', sessionCard || 'None scheduled for today');

  // 4. Recent study_sessions
  // Fallback to chat_sessions assuming study_sessions might be chat_sessions in MVP
  const { data: recentSessions } = await supabase.from('chat_sessions').select('id, title, message_count, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
  console.log('Recent Sessions (Chat):', recentSessions);

  // 5. Concepts count & weak concepts
  const { count: conceptsCount } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  const { data: weakConcepts } = await supabase.from('concepts').select('name, subject, chapter').eq('user_id', userId).eq('mastery_tier', 'weak').limit(5);
  console.log(`Total Concepts: ${conceptsCount}`);
  console.log('Weak Concepts (top 5):', weakConcepts);

  // 6. Due revision cards
  const { count: dueCards } = await supabase.from('revision_cards').select('*', { count: 'exact', head: true }).eq('user_id', userId).lte('due_at', new Date().toISOString()).neq('state', 'suspended');
  console.log(`Due Revision Cards: ${dueCards}`);

  // 7. Recent mock_autopsies
  const { data: autopsies } = await supabase.from('mock_autopsies').select('id, test_name, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
  console.log('Recent Mock Autopsies:', autopsies);

  // 8. Recent autopsy_questions (assuming mistakes table)
  const { data: mistakes } = await supabase.from('mistakes').select('category, question_text').eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
  console.log('Recent Mistakes (Autopsy Questions):', mistakes);

  // 9. Global chat session
  const { data: globalChat } = await supabase.from('chat_sessions').select('id, title').eq('user_id', userId).eq('title', 'Global Session').maybeSingle();
  console.log('Global Chat Session:', globalChat || 'Not found');

  // 10. Last 10 chat messages
  if (recentSessions && recentSessions.length > 0) {
    const { data: messages } = await supabase.from('chat_messages').select('role, content, created_at').eq('session_id', recentSessions[0].id).order('created_at', { ascending: false }).limit(10);
    console.log(`Last 10 Chat Messages (Session: ${recentSessions[0].id}):`, messages?.reverse().map(m => `[${m.role}] ${m.content.substring(0, 50)}...`));
  }

  // 11. chat_memory count
  const { count: memoryCount } = await supabase.from('chat_memory').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  console.log(`Chat Memory Entries: ${memoryCount}`);

  // 12. pending/failed events
  const { count: pendingEvents } = await supabase.from('student_events').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending');
  const { count: failedEvents } = await supabase.from('student_events').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'failed');
  console.log(`Events -> Pending: ${pendingEvents}, Failed: ${failedEvents}`);

  console.log('\nDone.');
}

debugUser();
