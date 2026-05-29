-- 1. Create Semantic Memory Table for Chat Vectors
CREATE TABLE IF NOT EXISTS chat_memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enforce Strict RLS on Chat Memory
ALTER TABLE chat_memory_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own chat_memory_embeddings" ON chat_memory_embeddings;
CREATE POLICY "Users access own chat_memory_embeddings" ON chat_memory_embeddings FOR ALL USING (auth.uid() = user_id);

-- 3. Create RPC for Semantic Memory Match
CREATE OR REPLACE FUNCTION match_chat_memory (
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chat_memory_embeddings.id,
    chat_memory_embeddings.content,
    1 - (chat_memory_embeddings.embedding <=> query_embedding) AS similarity
  FROM chat_memory_embeddings
  WHERE chat_memory_embeddings.user_id = p_user_id
    AND 1 - (chat_memory_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY chat_memory_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Ensure RLS on all remaining peripheral tables
ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own learning_goals" ON learning_goals;
CREATE POLICY "Users access own learning_goals" ON learning_goals FOR ALL USING (auth.uid() = user_id);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own chat_sessions" ON chat_sessions;
CREATE POLICY "Users access own chat_sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own chat_messages" ON chat_messages;
CREATE POLICY "Users access own chat_messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);
