-- 017_hybrid_search.sql
-- Phase 10: Source-Grounded Knowledge Engine (NotebookLM Clone)

-- 1. Add FTS vector column to material_chunks
ALTER TABLE material_chunks 
ADD COLUMN IF NOT EXISTS fts_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED;

-- 2. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_material_chunks_fts 
ON material_chunks USING GIN (fts_vector);

-- 3. Create Audio Overviews table
CREATE TABLE IF NOT EXISTS audio_overviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  material_id uuid REFERENCES materials(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  transcript text NOT NULL,
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE audio_overviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own audio overviews" ON audio_overviews
FOR ALL USING (auth.uid() = user_id);

-- 4. Hybrid Search Function using Reciprocal Rank Fusion (RRF)
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
    p_user_id uuid,
    p_query_text text,
    p_query_embedding vector(1536),
    p_match_count int DEFAULT 10,
    p_full_text_weight float DEFAULT 1.0,
    p_semantic_weight float DEFAULT 1.0,
    p_rrf_k int DEFAULT 60
)
RETURNS TABLE (
    id uuid,
    material_id uuid,
    chunk_text text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT mc.id, RANK() OVER (ORDER BY mc.embedding <=> p_query_embedding) as rank
        FROM material_chunks mc
        WHERE mc.user_id = p_user_id
        ORDER BY mc.embedding <=> p_query_embedding
        LIMIT p_match_count * 2
    ),
    keyword_search AS (
        SELECT mc.id, RANK() OVER (ORDER BY ts_rank_cd(mc.fts_vector, plainto_tsquery('english', p_query_text)) DESC) as rank
        FROM material_chunks mc
        WHERE mc.user_id = p_user_id AND mc.fts_vector @@ plainto_tsquery('english', p_query_text)
        ORDER BY ts_rank_cd(mc.fts_vector, plainto_tsquery('english', p_query_text)) DESC
        LIMIT p_match_count * 2
    )
    SELECT
        c.id,
        c.material_id,
        c.chunk_text,
        (COALESCE(1.0 / (p_rrf_k + ss.rank), 0.0) * p_semantic_weight +
         COALESCE(1.0 / (p_rrf_k + ks.rank), 0.0) * p_full_text_weight)::float AS similarity
    FROM material_chunks c
    LEFT JOIN semantic_search ss ON ss.id = c.id
    LEFT JOIN keyword_search ks ON ks.id = c.id
    WHERE (ss.id IS NOT NULL OR ks.id IS NOT NULL) AND c.user_id = p_user_id
    ORDER BY similarity DESC
    LIMIT p_match_count;
END;
$$;
