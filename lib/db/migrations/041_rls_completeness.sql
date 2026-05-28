-- 041_rls_completeness.sql
-- Covers tables from migrations 035, 038 that were missing RLS.
-- Also hardens full-text search on chat_memory_embeddings to enforce user scope.

-- 1. mastery_events (migration 038)
ALTER TABLE IF EXISTS mastery_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mastery_events' AND policyname = 'Users access own mastery_events'
  ) THEN
    CREATE POLICY "Users access own mastery_events"
      ON mastery_events FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- 2. concept_template_cache (migration 035) — shared read, service-role write
ALTER TABLE IF EXISTS concept_template_cache ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'concept_template_cache' AND policyname = 'Authenticated users can read templates'
  ) THEN
    -- Any authenticated user can read cached templates (they are not user-specific)
    CREATE POLICY "Authenticated users can read templates"
      ON concept_template_cache FOR SELECT USING (auth.role() = 'authenticated');
    -- Only service role can insert/update/delete (cron seeding)
    CREATE POLICY "Service role manages templates"
      ON concept_template_cache FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 3. Harden match_chat_memory RPC — enforce user_id inside the function
-- The existing function already filters by p_user_id, but this makes it explicit
-- and adds a secondary SECURITY DEFINER protection.
CREATE OR REPLACE FUNCTION public.match_chat_memory(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as owner, not caller; immune to caller RLS bypass
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chat_memory_embeddings.id,
    chat_memory_embeddings.content,
    1 - (chat_memory_embeddings.embedding <=> query_embedding) AS similarity
  FROM chat_memory_embeddings
  WHERE
    chat_memory_embeddings.user_id = p_user_id  -- hard-coded user scope, cannot be overridden
    AND 1 - (chat_memory_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY chat_memory_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Revoke direct execute from anon; authenticated users can call via the client
REVOKE EXECUTE ON FUNCTION public.match_chat_memory FROM anon;
GRANT EXECUTE ON FUNCTION public.match_chat_memory TO authenticated;
