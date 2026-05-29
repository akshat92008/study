-- 038_mastery_events.sql
-- Records every mastery state change with its source and evidence.
-- COMMAND reads this table to understand why mastery changed.

CREATE TABLE IF NOT EXISTS mastery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  old_mastery TEXT,
  new_mastery TEXT NOT NULL,
  source TEXT NOT NULL, -- 'session_close' | 'card_review' | 'autopsy' | 'onboarding' | 'tutor_session'
  source_id TEXT,       -- session_id, card_id, autopsy_id, etc.
  evidence TEXT,        -- short human-readable reason
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mastery_events_user
  ON mastery_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mastery_events_concept
  ON mastery_events(concept_id, created_at DESC);

ALTER TABLE mastery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own mastery_events"
  ON mastery_events FOR ALL USING (auth.uid() = user_id);
