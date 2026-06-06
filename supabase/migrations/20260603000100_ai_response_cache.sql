-- supabase/migrations/20260603000100_ai_response_cache.sql

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key text UNIQUE NOT NULL,
  task text NOT NULL,
  model text,
  provider text,
  input_hash text NOT NULL,
  response_json jsonb,
  response_text text,
  token_estimate int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_response_cache_expires_idx ON ai_response_cache (expires_at);
CREATE INDEX IF NOT EXISTS ai_response_cache_task_hash_idx ON ai_response_cache (task, input_hash);
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;
-- Only readable/writable by service role / admin (enforced by lack of public policies);
