-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables and types if re-running to allow clean initialization
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

-- Create enums
CREATE TYPE mastery_level AS ENUM ('not_started','exposed','developing','proficient','mastered','automated');
CREATE TYPE confidence_level AS ENUM ('very_low','low','medium','high','very_high');
CREATE TYPE mistake_category AS ENUM ('conceptual','calculation','silly','time_pressure','misread','incomplete_knowledge','overconfidence','anxiety','recall_failure');
CREATE TYPE emotional_state AS ENUM ('focused','motivated','stressed','burnt_out','anxious','frustrated','confident','overwhelmed','bored','neutral');
CREATE TYPE task_type AS ENUM ('study','revision','practice','mock_test','break','review');
CREATE TYPE task_priority AS ENUM ('critical','high','medium','low');

-- Profiles
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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- Concepts
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

-- Concept Links
CREATE TABLE concept_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'prerequisite',
  strength REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mistakes
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

-- Revision Cards
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

-- Review Logs
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

-- Study Tasks
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

-- Tutor Sessions
CREATE TABLE tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  messages JSONB DEFAULT '[]',
  cognitive_level TEXT DEFAULT 'intermediate',
  understanding_gained INT DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Study Sessions
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

-- ======= RLS POLICIES =======
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

-- Policy: users can only access their own data
CREATE POLICY "Users access own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users access own concepts" ON concepts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own concept_links" ON concept_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own mistakes" ON mistakes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own revision_cards" ON revision_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own review_logs" ON review_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own study_tasks" ON study_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own mock_tests" ON mock_tests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own perf_snapshots" ON performance_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own mentor_chats" ON mentor_chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own tutor_sessions" ON tutor_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own study_sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_concepts_user ON concepts(user_id);
CREATE INDEX idx_concepts_subject ON concepts(user_id, subject);
CREATE INDEX idx_mistakes_user ON mistakes(user_id);
CREATE INDEX idx_revision_due ON revision_cards(user_id, due);
CREATE INDEX idx_tasks_date ON study_tasks(user_id, scheduled_date);
CREATE INDEX idx_perf_date ON performance_snapshots(user_id, date);
CREATE INDEX idx_mentor_user ON mentor_chats(user_id, created_at);
