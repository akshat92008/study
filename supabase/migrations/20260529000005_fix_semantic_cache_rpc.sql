-- Drop and recreate with SECURITY DEFINER so it bypasses RLS
-- (same logic as increment_cache_access already does correctly)
CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  response_text text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

-- Revoke from anon, grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.match_semantic_cache FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_semantic_cache FROM public;
GRANT EXECUTE ON FUNCTION public.match_semantic_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_semantic_cache TO service_role;
