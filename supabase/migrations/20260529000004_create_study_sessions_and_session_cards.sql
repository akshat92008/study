-- 20260529000004_create_study_sessions_and_session_cards.sql

-- Study Sessions
CREATE TABLE IF NOT EXISTS study_sessions (
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

-- Session Cards
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

-- RLS Policies
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own study_sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own session_cards" ON session_cards FOR ALL USING (auth.uid() = user_id);
