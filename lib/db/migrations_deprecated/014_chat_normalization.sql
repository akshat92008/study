-- 014_chat_normalization.sql
-- Phase 1: Database & RLS Hardening

-- 1. Create student_events table
CREATE TABLE IF NOT EXISTS student_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL, -- e.g., 'TASK_COMPLETED', 'MISTAKE_DETECTED', 'REVISION_REVIEWED'
  data jsonb NOT NULL,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_type text NOT NULL, -- 'global', 'tutor', 'mentor'
  concept_id uuid REFERENCES concepts(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'user', 'assistant', 'system'
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_events' AND policyname = 'Users can manage their own student events'
  ) THEN
    CREATE POLICY "Users can manage their own student events" ON student_events
    FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_sessions' AND policyname = 'Users can manage their own chat sessions'
  ) THEN
    CREATE POLICY "Users can manage their own chat sessions" ON chat_sessions
    FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_messages' AND policyname = 'Users can manage their own chat messages'
  ) THEN
    CREATE POLICY "Users can manage their own chat messages" ON chat_messages
    FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

-- 6. Create composite indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revision_cards_user_due ON revision_cards(user_id, due ASC);
CREATE INDEX IF NOT EXISTS idx_concepts_user_subject_chapter ON concepts(user_id, subject, chapter);
CREATE INDEX IF NOT EXISTS idx_mistakes_user_created ON mistakes(user_id, created_at DESC);
