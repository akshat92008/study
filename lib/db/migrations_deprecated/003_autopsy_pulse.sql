-- ================================================
-- Phase 3: Autopsy + PULSE tables
-- Run after 001_init.sql and 002_phase2.sql
-- ================================================

-- Mock Autopsies (AI-analyzed test results)
CREATE TABLE IF NOT EXISTS mock_autopsies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  current_score INTEGER NOT NULL DEFAULT 0,
  potential_score INTEGER NOT NULL DEFAULT 0,
  recoverable_marks INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER,
  exam_type TEXT DEFAULT 'NEET',
  mentor_insight TEXT,
  mentor_quote TEXT,
  praise_roast_tag TEXT,
  confidence_level TEXT DEFAULT 'Medium',
  ocr_raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Autopsy Questions (per-question breakdown)
CREATE TABLE IF NOT EXISTS autopsy_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autopsy_id UUID NOT NULL REFERENCES mock_autopsies(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  subtopic TEXT,
  difficulty TEXT DEFAULT 'Medium',
  status TEXT NOT NULL, -- 'Correct', 'Incorrect', 'Unattempted'
  correct_answer TEXT,
  student_answer TEXT,
  mistake_category TEXT, -- from mistake_category enum values
  marks_lost REAL DEFAULT 0,
  suggested_fix TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recovery Plans (actionable study blueprints from autopsies)
CREATE TABLE IF NOT EXISTS recovery_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autopsy_id UUID NOT NULL REFERENCES mock_autopsies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expected_marks_gain INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 60,
  tasks JSONB NOT NULL DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PULSE Signals (emotional/behavioral telemetry)
CREATE TABLE IF NOT EXISTS pulse_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'self_report', 'session_pattern', 'performance_trend'
  emotional_state emotional_state NOT NULL,
  confidence REAL DEFAULT 0.5,
  session_duration_minutes INTEGER,
  recent_accuracy REAL,
  interaction_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE mock_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopsy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own autopsies" ON mock_autopsies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own autopsy_questions" ON autopsy_questions FOR ALL
  USING (autopsy_id IN (SELECT id FROM mock_autopsies WHERE user_id = auth.uid()));
CREATE POLICY "Users access own recovery_plans" ON recovery_plans FOR ALL
  USING (autopsy_id IN (SELECT id FROM mock_autopsies WHERE user_id = auth.uid()));
CREATE POLICY "Users access own pulse_signals" ON pulse_signals FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_autopsies_user ON mock_autopsies(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_autopsy_qs_autopsy ON autopsy_questions(autopsy_id);
CREATE INDEX IF NOT EXISTS idx_pulse_user ON pulse_signals(user_id, created_at);
