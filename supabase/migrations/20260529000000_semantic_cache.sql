-- Migration: Semantic Cache for AI Responses

CREATE TABLE IF NOT EXISTS semantic_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_hash text NOT NULL UNIQUE,
    prompt_text text NOT NULL,
    response_text text NOT NULL,
    embedding vector(768),
    created_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    access_count integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx ON semantic_cache USING hnsw (embedding vector_cosine_ops);
CREATE OR REPLACE FUNCTION match_semantic_cache(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  response_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response_text,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
-- Enable Row Level Security
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
-- Deny all direct access to authenticated users (only service_role or SECURITY DEFINER RPCs can access)
CREATE POLICY "Deny all to semantic cache for authenticated users"
ON semantic_cache
FOR ALL
TO authenticated
USING (false);
-- Create missing RPC for cache access increments
CREATE OR REPLACE FUNCTION increment_cache_access(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE semantic_cache
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;
