-- Migration: Universal Event Bus & Persistent Global Orchestrator Chat

CREATE TABLE student_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orchestrator_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own events" ON student_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own global chats" ON orchestrator_chats FOR ALL USING (auth.uid() = user_id);
