-- ==========================================
-- COGNITION OS UNIFIED MASTER DATABASE SETUP
-- ==========================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop existing tables and types for clean initialization
DROP TABLE IF EXISTS institute_memberships CASCADE;
DROP TABLE IF EXISTS institutes CASCADE;
DROP TABLE IF EXISTS pulse_signals CASCADE;
DROP TABLE IF EXISTS recovery_plans CASCADE;
DROP TABLE IF EXISTS autopsy_questions CASCADE;
DROP TABLE IF EXISTS mock_autopsies CASCADE;
DROP TABLE IF EXISTS student_models CASCADE;
DROP TABLE IF EXISTS material_chunks CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS concept_links CASCADE;
DROP TABLE IF EXISTS mistakes CASCADE;
DROP TABLE IF EXISTS review_logs CASCADE;
DROP TABLE IF EXISTS revision_cards CASCADE;
DROP TABLE IF EXISTS study_tasks CASCADE;
DROP TABLE IF EXISTS mock_tests CASCADE;
DROP TABLE IF EXISTS performance_snapshots CASCADE;
DROP TABLE IF EXISTS mentor_chats CASCADE;
DROP TABLE IF EXISTS tutor_sessions CASCADE;
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS concepts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS mastery_level CASCADE;
DROP TYPE IF EXISTS confidence_level CASCADE;
DROP TYPE IF EXISTS mistake_category CASCADE;
DROP TYPE IF EXISTS emotional_state CASCADE;
DROP TYPE IF EXISTS task_type CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;

-- 3. Create Custom ENUMs
CREATE TYPE mastery_level AS ENUM ('not_started','exposed','developing','proficient','mastered','automated');
CREATE TYPE confidence_level AS ENUM ('very_low','low','medium','high','very_high');
CREATE TYPE mistake_category AS ENUM ('conceptual','calculation','silly','time_pressure','misread','incomplete_knowledge','overconfidence','anxiety','recall_failure');
CREATE TYPE emotional_state AS ENUM ('focused','motivated','stressed','burnt_out','anxious','frustrated','confident','overwhelmed','bored','neutral');
CREATE TYPE task_type AS ENUM ('study','revision','practice','mock_test','break','review');
CREATE TYPE task_priority AS ENUM ('critical','high','medium','low');

-- 4. Create Tables

-- Profiles (Users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  exam_type TEXT DEFAULT 'NEET',
  target_year INT,
  target_score INT,
  current_score INT,
  study_hours_per_day INT DEFAULT 8,
  emotional_state emotional_state DEFAULT 'neutral',
  onboarding_complete BOOLEAN DEFAULT false,
  streak_days INT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Concepts (ATLAS Knowledge Graph nodes)
CREATE TABLE concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  topic TEXT DEFAULT '',
  mastery mastery_level DEFAULT 'not_started',
  confidence confidence_level DEFAULT 'low',
  last_reviewed_at TIMESTAMPTZ,
  times_reviewed INT DEFAULT 0,
  times_correct INT DEFAULT 0,
  times_incorrect INT DEFAULT 0,
  forgetting_probability REAL DEFAULT 1.0,
  retention_strength REAL DEFAULT 0.0,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Concept Links (ATLAS Knowledge Graph edges)
CREATE TABLE concept_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'prerequisite',
  strength REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mistakes (Mistake Engine logger)
CREATE TABLE mistakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  category mistake_category NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  topic TEXT DEFAULT '',
  question_text TEXT,
  user_answer TEXT,
  correct_answer TEXT,
  marks_lost REAL DEFAULT 0,
  total_marks REAL DEFAULT 0,
  time_spent_seconds INT,
  ai_analysis TEXT,
  improvement_suggestion TEXT,
  is_recurring BOOLEAN DEFAULT false,
  occurrence_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Revision Cards (MEMORY FSRS Cards)
CREATE TABLE revision_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  due TIMESTAMPTZ DEFAULT now(),
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state INT DEFAULT 0,
  last_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Review Logs (FSRS Repetition logs)
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES revision_cards(id) ON DELETE CASCADE,
  rating INT NOT NULL,
  elapsed_days INT,
  scheduled_days INT,
  review TIMESTAMPTZ DEFAULT now(),
  state INT
);

-- Study Tasks (Planner schedule items)
CREATE TABLE study_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type task_type DEFAULT 'study',
  subject TEXT,
  chapter TEXT,
  priority task_priority DEFAULT 'medium',
  estimated_minutes INT DEFAULT 45,
  scheduled_date TIMESTAMPTZ NOT NULL,
  scheduled_start_time TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  focus_score INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mock Tests
CREATE TABLE mock_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  total_questions INT NOT NULL,
  attempted INT DEFAULT 0,
  correct INT DEFAULT 0,
  incorrect INT DEFAULT 0,
  unattempted INT DEFAULT 0,
  total_marks REAL NOT NULL,
  marks_obtained REAL DEFAULT 0,
  negative_marks REAL DEFAULT 0,
  time_taken INT,
  total_time INT,
  subject_wise JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Snapshots
CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  study_minutes INT DEFAULT 0,
  concepts_learned INT DEFAULT 0,
  concepts_revised INT DEFAULT 0,
  questions_attempted INT DEFAULT 0,
  questions_correct INT DEFAULT 0,
  accuracy REAL DEFAULT 0,
  focus_score REAL DEFAULT 0,
  retention_rate REAL DEFAULT 0,
  emotional_state emotional_state DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mentor Chats
CREATE TABLE mentor_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tutor Sessions (AI MIND Socratic Tutor sessions)
CREATE TABLE tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  messages JSONB DEFAULT '[]',
  cognitive_level TEXT DEFAULT 'intermediate',
  understanding_gained INT DEFAULT 0,
  summary TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Study Sessions (Active telemetry tracker)
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  chapter TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  focus_score INT,
  breaks_taken INT DEFAULT 0,
  notes TEXT
);

-- Materials (Uploaded notes and source files)
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT DEFAULT 'text', -- 'pdf', 'note', 'web'
  raw_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Material Chunks (RAG vector slices)
CREATE TABLE material_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(768), -- Gemini text-embedding-004 dimensions
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Student Models (Longitudinal modeling database)
CREATE TABLE student_models (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  learning_style TEXT,
  strengths TEXT[],
  chronic_weaknesses TEXT[],
  behavioral_traps TEXT[],
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Mock Autopsies (AI OMR/PDF extraction test logs)
CREATE TABLE mock_autopsies (
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

-- Autopsy Questions (Individual extracted test answers)
CREATE TABLE autopsy_questions (
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
  mistake_category TEXT,
  marks_lost REAL DEFAULT 0,
  suggested_fix TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recovery Plans (Autopsy action blueprints)
CREATE TABLE recovery_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autopsy_id UUID NOT NULL REFERENCES mock_autopsies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  expected_marks_gain INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 60,
  tasks JSONB NOT NULL DEFAULT '[]',
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PULSE Signals (Real-time student cognitive telemetry)
CREATE TABLE pulse_signals (
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

-- Institutes (Educator Dashboard groups)
CREATE TABLE institutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Institute Memberships
CREATE TABLE institute_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student',
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Set Up Automated Profile / Model Creation Triggers

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create student model on profile creation
CREATE OR REPLACE FUNCTION initialize_student_model()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO student_models (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION initialize_student_model();

-- 6. Create Indexes & HNSW Vector Indexes
CREATE INDEX IF NOT EXISTS idx_concepts_user ON concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_subject ON concepts(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_due ON revision_cards(user_id, due);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON study_tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_perf_date ON performance_snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_mentor_user ON mentor_chats(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_autopsies_user ON mock_autopsies(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_autopsy_qs_autopsy ON autopsy_questions(autopsy_id);
CREATE INDEX IF NOT EXISTS idx_pulse_user ON pulse_signals(user_id, created_at);

-- HNSW Vector indexes for rapid search
CREATE INDEX IF NOT EXISTS idx_material_chunks_hnsw ON material_chunks USING hnsw (embedding vector_ip_ops);
CREATE INDEX IF NOT EXISTS idx_concepts_hnsw ON concepts USING hnsw (embedding vector_ip_ops);

-- 7. Force Enable RLS
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
ALTER TABLE student_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopsy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE institute_memberships ENABLE ROW LEVEL SECURITY;

-- 8. Apply RLS Policies

CREATE POLICY "Users access own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own concepts" ON concepts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own concept_links" ON concept_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own mistakes" ON mistakes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own revision_cards" ON revision_cards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own review_logs" ON review_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own study_tasks" ON study_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own mock_tests" ON mock_tests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own perf_snapshots" ON performance_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own mentor_chats" ON mentor_chats FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own tutor_sessions" ON tutor_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own study_sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own materials" ON materials FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own material_chunks" ON material_chunks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own student_models" ON student_models FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own mock_autopsies" ON mock_autopsies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users access own institutes" ON institutes FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users access own memberships" ON institute_memberships FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users access own autopsy_questions" ON autopsy_questions FOR ALL
  USING (autopsy_id IN (SELECT id FROM mock_autopsies WHERE user_id = auth.uid()))
  WITH CHECK (autopsy_id IN (SELECT id FROM mock_autopsies WHERE user_id = auth.uid()));

CREATE POLICY "Users access own recovery_plans" ON recovery_plans FOR ALL
  USING (autopsy_id IN (SELECT id FROM mock_autopsies WHERE user_id = auth.uid()))
  WITH CHECK (autopsy_id IN (SELECT id FROM mock_autopsies WHERE user_id = auth.uid()));

-- 9. Create Gemini Vector Similarity Search RPC Functions

-- Vector search for concepts (Knowledge Graph Autopsies)
CREATE OR REPLACE FUNCTION match_concepts(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM concepts
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Vector search for material chunks (RAG Document Q&A)
CREATE OR REPLACE FUNCTION match_material_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM material_chunks
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Dummy Rate Limiter (Prevents your API from crashing, always allows access)
CREATE OR REPLACE FUNCTION check_rate_limit(p_ip text, p_limit int, p_window_seconds int)
RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RETURN true; END; $$;
