-- Migration: Semantic Memory for Chat
-- This extends the base chat schema from 014_chat_normalization.sql with pgvector

CREATE TABLE IF NOT EXISTS chat_memory_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE chat_memory_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own memory embeddings
CREATE POLICY "Users can access their own memory embeddings"
  ON chat_memory_embeddings FOR ALL USING (auth.uid() = user_id);

-- Create HNSW index for efficient vector similarity search
CREATE INDEX IF NOT EXISTS idx_chat_memory_embeddings_hnsw 
  ON chat_memory_embeddings USING hnsw (embedding vector_cosine_ops);
