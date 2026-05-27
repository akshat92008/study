-- 036_session_close_columns.sql
-- Adds the columns that session-close route actually writes.
-- Without these, every session close silently discards all metadata.

ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS concept_name TEXT,
  ADD COLUMN IF NOT EXISTS understood BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gap_found TEXT,
  ADD COLUMN IF NOT EXISTS cards_created INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for fetching completed sessions by user in recency order
CREATE INDEX IF NOT EXISTS idx_study_sessions_completed
  ON study_sessions(user_id, completed_at DESC NULLS LAST);
