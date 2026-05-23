-- Rate limit log (for Fix 1)
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_created ON rate_limit_log(key, created_at);

-- Ensure study_sessions table has needed columns
ALTER TABLE study_sessions 
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- Ensure profiles has streak tracking
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emotional_state TEXT DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- Streak auto-reset: if last_active_date is not yesterday, reset streak
CREATE OR REPLACE FUNCTION reset_broken_streaks()
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET streak_days = 0
  WHERE last_active_date < CURRENT_DATE - INTERVAL '1 day'
    AND streak_days > 0;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup rate limits
SELECT cron.schedule(
  'cleanup-rate-limits', 
  '0 * * * *',
  $$DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '2 hours'$$
);

-- RLS for rate_limit_log
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON rate_limit_log USING (true) WITH CHECK (true);
