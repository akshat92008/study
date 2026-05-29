-- Run in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rate_limit_key_created ON rate_limit_log(key, created_at);

-- Auto-cleanup: delete entries older than 24 hours every hour
SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 
  $$DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '24 hours'$$
);
