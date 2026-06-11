const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ubzvhajvcoiovkgwnsgu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVienZoYWp2Y29pb3ZrZ3duc2d1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUxNDE0NSwiZXhwIjoyMDk0MDkwMTQ1fQ.rnCUgSPoqaWLzERdZ5oR8Zt82ynjctnUDytn2sKXflI', { auth: { persistSession: false } });

async function run() {
  const { data, error } = await supabase.rpc('upsert_session_card', {
    p_row: {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      date: '2026-10-10',
      goal_id: null,
      learner_state_version: 1,
      dayNumber: 1,
      streakDays: 1,
      focusTopic: 'Test',
      subject: 'Test',
      estimatedMinutes: 45,
      rationale: 'Test',
      daysToExam: 10,
      overdueCards: 0,
      masteryPercent: 0,
      task_type: 'concept_study',
      resource_type: 'practice_questions',
      priority: 'concept_study'
    }
  });
  console.log({ data, error });
}
run();
