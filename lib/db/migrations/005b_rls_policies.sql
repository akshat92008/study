-- ==============================================================================
-- CRITICAL SECURITY PATCH: ENFORCE RLS ON ALL TABLES
-- This script enables Row Level Security and restricts access to auth.uid()
-- ==============================================================================

-- 1. Profiles (Uses 'id' instead of 'user_id')
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own profiles" ON profiles;
CREATE POLICY "Users access own profiles" ON profiles FOR ALL USING (auth.uid() = id);

-- 2. Standard Tables with direct 'user_id'
-- (Includes Phase 1 tables and new Phase 2-5 tables)
DO $$ 
DECLARE 
  t text; 
  tables text[] := ARRAY[
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
    'tutor_session_states',
    'study_sessions', 
    'student_models', 
    'materials', 
    'material_chunks', 
    'mock_autopsies', 
    'pulse_signals', 
    'student_events', 
    'orchestrator_chats', 
    'learner_states', 
    'learner_daily_metrics', 
    'chat_sessions', 
    'chat_messages', 
    'episodic_memories'
  ];
BEGIN 
  FOREACH t IN ARRAY tables LOOP 
    -- Enable RLS
    EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY;', t);
    
    -- Drop existing generic policies if they exist to avoid conflicts
    EXECUTE format('DROP POLICY IF EXISTS "Users access own %I" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users_access_own_data" ON %I;', t);
    
    -- Create strict user_id matching policy
    EXECUTE format('CREATE POLICY "Users access own %I" ON %I FOR ALL USING (auth.uid() = user_id);', t, t);
  END LOOP; 
END $$;

-- 3. Indirectly Owned Tables (Join through parent table)

-- Autopsy Questions: Accessible only if the user owns the parent mock_autopsies record
ALTER TABLE IF EXISTS autopsy_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own autopsy_questions" ON autopsy_questions;
CREATE POLICY "Users access own autopsy_questions" ON autopsy_questions FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM mock_autopsies ma 
    WHERE ma.id = autopsy_questions.autopsy_id 
    AND ma.user_id = auth.uid()
  )
);

-- Recovery Plans: Accessible only if the user owns the parent mock_autopsies record
ALTER TABLE IF EXISTS recovery_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own recovery_plans" ON recovery_plans;
CREATE POLICY "Users access own recovery_plans" ON recovery_plans FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM mock_autopsies ma 
    WHERE ma.id = recovery_plans.autopsy_id 
    AND ma.user_id = auth.uid()
  )
);

-- 4. B2B / Teams Tables

-- Institutes: Only the owner can access/manage the institute
ALTER TABLE IF EXISTS institutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their institutes" ON institutes;
CREATE POLICY "Owners manage their institutes" ON institutes FOR ALL 
USING (auth.uid() = owner_id);

-- Institute Memberships: Users can see their own memberships, Owners see their students
ALTER TABLE IF EXISTS institute_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own memberships" ON institute_memberships;
DROP POLICY IF EXISTS "Institute owners view their students" ON institute_memberships;

CREATE POLICY "Users view own memberships" ON institute_memberships FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Institute owners view their students" ON institute_memberships FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM institutes i 
    WHERE i.id = institute_memberships.institute_id 
    AND i.owner_id = auth.uid()
  )
);
