-- Enable RLS on all user tables
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
ALTER TABLE orchestrator_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_models ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own row
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (auth.uid() = id);

-- Learning Goals: users own their goals
CREATE POLICY "goals_owner" ON learning_goals FOR ALL USING (auth.uid() = user_id);

-- Concepts: users own their concepts
CREATE POLICY "concepts_owner" ON concepts FOR ALL USING (auth.uid() = user_id);

-- Concept Links: users own their links
CREATE POLICY "concept_links_owner" ON concept_links FOR ALL USING (auth.uid() = user_id);

-- Mistakes: users own their mistakes
CREATE POLICY "mistakes_owner" ON mistakes FOR ALL USING (auth.uid() = user_id);

-- Revision Cards: users own their cards
CREATE POLICY "revision_cards_owner" ON revision_cards FOR ALL USING (auth.uid() = user_id);

-- Review Logs: users own their logs
CREATE POLICY "review_logs_owner" ON review_logs FOR ALL USING (auth.uid() = user_id);

-- Tutor Sessions: users own their sessions
CREATE POLICY "tutor_sessions_owner" ON tutor_sessions FOR ALL USING (auth.uid() = user_id);

-- Study Tasks: users own their tasks
CREATE POLICY "study_tasks_owner" ON study_tasks FOR ALL USING (auth.uid() = user_id);

-- Mock Autopsies: users own their autopsies
CREATE POLICY "mock_autopsies_owner" ON mock_autopsies FOR ALL USING (auth.uid() = user_id);

-- Autopsy Questions: accessible if user owns the parent autopsy
CREATE POLICY "autopsy_questions_owner" ON autopsy_questions FOR ALL 
  USING (EXISTS (SELECT 1 FROM mock_autopsies WHERE id = autopsy_questions.autopsy_id AND user_id = auth.uid()));

-- Recovery Plans: accessible if user owns the parent autopsy
CREATE POLICY "recovery_plans_owner" ON recovery_plans FOR ALL 
  USING (EXISTS (SELECT 1 FROM mock_autopsies WHERE id = recovery_plans.autopsy_id AND user_id = auth.uid()));

-- Pulse Signals: users own their signals
CREATE POLICY "pulse_signals_owner" ON pulse_signals FOR ALL USING (auth.uid() = user_id);

-- Orchestrator Chats: users own their chat
CREATE POLICY "orchestrator_chats_owner" ON orchestrator_chats FOR ALL USING (auth.uid() = user_id);

-- Student Events: users own their events
CREATE POLICY "student_events_owner" ON student_events FOR ALL USING (auth.uid() = user_id);

-- Performance Snapshots: users own their snapshots
CREATE POLICY "perf_snapshots_owner" ON performance_snapshots FOR ALL USING (auth.uid() = user_id);

-- Materials: users own their materials
CREATE POLICY "materials_owner" ON materials FOR ALL USING (auth.uid() = user_id);

-- Material Chunks: accessible if user owns parent material
CREATE POLICY "material_chunks_owner" ON material_chunks FOR ALL 
  USING (EXISTS (SELECT 1 FROM materials WHERE id = material_chunks.material_id AND user_id = auth.uid()));

-- Student Models: users own their model
CREATE POLICY "student_models_owner" ON student_models FOR ALL USING (auth.uid() = user_id);
