CREATE TABLE IF NOT EXISTS session_closing_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('success', 'partial', 'gap_identified')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scm_user_id ON session_closing_messages (user_id, created_at DESC);

ALTER TABLE session_closing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_closing_messages"
  ON session_closing_messages
  FOR ALL
  USING (auth.uid() = user_id);
