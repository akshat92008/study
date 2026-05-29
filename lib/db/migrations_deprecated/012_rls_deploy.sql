-- ==============================================================================
-- MIGRATION 012: ENFORCE RLS ON ALL TABLES
-- Matches schema definition in lib/db/schema.ts
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopsy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodic_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE institute_memberships ENABLE ROW LEVEL SECURITY;

-- 2. Direct User-Owned Tables (Tables with user_id)
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "goals_owner" ON learning_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "concepts_owner" ON concepts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "concept_links_owner" ON concept_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "mistakes_owner" ON mistakes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "revision_cards_owner" ON revision_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "review_logs_owner" ON review_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tutor_sessions_owner" ON tutor_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "study_tasks_owner" ON study_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "mock_autopsies_owner" ON mock_autopsies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pulse_signals_owner" ON pulse_signals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "student_events_owner" ON student_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "orchestrator_chats_owner" ON orchestrator_chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "perf_snapshots_owner" ON performance_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "materials_owner" ON materials FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "material_chunks_owner" ON material_chunks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "student_models_owner" ON student_models FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "learner_states_owner" ON learner_states FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "learner_daily_metrics_owner" ON learner_daily_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_sessions_owner" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "chat_messages_owner" ON chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "episodic_memories_owner" ON episodic_memories FOR ALL USING (auth.uid() = user_id);

-- 3. Indirectly Owned Tables (Join through parent table to check user_id)

-- Autopsy Questions: Join through mock_autopsies to check user_id
CREATE POLICY "autopsy_questions_owner" ON autopsy_questions FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM mock_autopsies ma 
    WHERE ma.id = autopsy_questions.autopsy_id 
    AND ma.user_id = auth.uid()
  )
);

-- Recovery Plans: Join through mock_autopsies to check user_id
CREATE POLICY "recovery_plans_owner" ON recovery_plans FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM mock_autopsies ma 
    WHERE ma.id = recovery_plans.autopsy_id 
    AND ma.user_id = auth.uid()
  )
);

-- 4. B2B / Teams Tables

-- Institutes: Only the owner can access/manage the institute
CREATE POLICY "institutes_owner" ON institutes FOR ALL 
USING (auth.uid() = owner_id);

-- Institute Memberships: Users can see memberships where they are the user
CREATE POLICY "memberships_self" ON institute_memberships FOR SELECT 
USING (auth.uid() = user_id);

-- Institute Memberships: Institute owners can view all memberships for their institute
CREATE POLICY "memberships_owner_view" ON institute_memberships FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM institutes i 
    WHERE i.id = institute_memberships.institute_id 
    AND i.owner_id = auth.uid()
  )
);
