-- 1. Function to find the right concept during Autopsy
CREATE OR REPLACE FUNCTION match_concepts(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM concepts
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 2. Function to search your uploaded PDFs/Notes (RAG)
CREATE OR REPLACE FUNCTION match_material_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    chunk_text,
    1 - (embedding <=> query_embedding) AS similarity
  FROM material_chunks
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 3. Dummy Rate Limiter (Prevents your API routes from crashing)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip text,
  p_limit int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always return true since it's just you using it!
  RETURN true;
END;
$$;
