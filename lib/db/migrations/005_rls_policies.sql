-- Enforce Row Level Security on all operational tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopsy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_signals ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: Users can read and update their own profile
CREATE POLICY "Users can manage own profile" ON profiles 
  FOR ALL USING (auth.uid() = id);

-- 2. Standard Tenant Isolation: ALL policies enforce `user_id = auth.uid()`
CREATE POLICY "Tenant isolation for concepts" ON concepts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for concept_links" ON concept_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for mistakes" ON mistakes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for revision_cards" ON revision_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for review_logs" ON review_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for study_tasks" ON study_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for mock_tests" ON mock_tests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for performance_snapshots" ON performance_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for mentor_chats" ON mentor_chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for tutor_sessions" ON tutor_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for study_sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for materials" ON materials FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for material_chunks" ON material_chunks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for mock_autopsies" ON mock_autopsies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tenant isolation for pulse_signals" ON pulse_signals FOR ALL USING (auth.uid() = user_id);

-- 3. Cascading Isolation for Sub-tables (They don't have user_id, so they join parent)
CREATE POLICY "Tenant isolation for autopsy_questions" ON autopsy_questions 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mock_autopsies WHERE id = autopsy_questions.autopsy_id AND user_id = auth.uid())
  );

CREATE POLICY "Tenant isolation for recovery_plans" ON recovery_plans 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM mock_autopsies WHERE id = recovery_plans.autopsy_id AND user_id = auth.uid())
  );
