-- 036a_create_session_cards.sql
-- Create the session_cards table which was missing but referenced in code.

CREATE TABLE IF NOT EXISTS session_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "dayNumber" INTEGER,
  "streakDays" INTEGER,
  "focusTopic" TEXT,
  subject TEXT,
  "estimatedMinutes" INTEGER,
  rationale TEXT,
  "daysToExam" INTEGER,
  "overdueCards" INTEGER,
  "masteryPercent" INTEGER,
  "closingMessage" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_session_cards_user_date ON session_cards(user_id, date);
