-- supabase/migrations/20260603000200_chat_session_summaries_and_usage_enhancements.sql

-- Session summary memory
CREATE TABLE IF NOT EXISTS chat_session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  summary text NOT NULL,
  key_facts jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, session_id)
);

ALTER TABLE chat_session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their session summaries"
  ON chat_session_summaries FOR ALL USING (user_id = auth.uid());

-- Enrich ai_usage_events (additive, never destructive)
DO $$ 
BEGIN
  -- Add cache_hit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'cache_hit') THEN
    ALTER TABLE ai_usage_events ADD COLUMN cache_hit boolean DEFAULT false;
  END IF;

  -- Add rule_first_hit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'rule_first_hit') THEN
    ALTER TABLE ai_usage_events ADD COLUMN rule_first_hit boolean DEFAULT false;
  END IF;

  -- Add skipped_providers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'skipped_providers') THEN
    ALTER TABLE ai_usage_events ADD COLUMN skipped_providers jsonb DEFAULT '[]';
  END IF;

  -- Add cost_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'cost_mode') THEN
    ALTER TABLE ai_usage_events ADD COLUMN cost_mode text DEFAULT 'ultra_cheap';
  END IF;

  -- Add tokens_saved_estimate
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'tokens_saved_estimate') THEN
    ALTER TABLE ai_usage_events ADD COLUMN tokens_saved_estimate int DEFAULT 0;
  END IF;
END $$;

-- Embedding deduplication
CREATE UNIQUE INDEX IF NOT EXISTS study_material_chunks_content_hash_embedding_idx
  ON study_material_chunks (user_id, content_hash, embedding_model)
  WHERE content_hash IS NOT NULL AND embedding_model IS NOT NULL;
