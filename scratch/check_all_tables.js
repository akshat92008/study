const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const tables = [
    'profiles',
    'learning_goals',
    'concepts',
    'concept_links',
    'mistakes',
    'revision_cards',
    'review_logs',
    'study_tasks',
    'mock_tests',
    'performance_snapshots',
    'mentor_chats',
    'tutor_sessions',
    'study_sessions',
    'student_models',
    'materials',
    'material_chunks',
    'mock_autopsies',
    'autopsy_questions',
    'recovery_plans',
    'pulse_signals',
    'institutes',
    'institute_memberships',
    'student_events',
    'orchestrator_chats',
    'learner_states',
    'learner_daily_metrics',
    'chat_sessions',
    'chat_messages'
  ];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table ${table} check failed: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table ${table} exists! Data length: ${data.length}`);
    }
  }
}

check();
