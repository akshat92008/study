-- 1. Create HNSW indexes for rapid Vector Searches (RAG / Knowledge Graph)
-- Required for production performance on vector similarities.
CREATE INDEX IF NOT EXISTS idx_material_chunks_hnsw ON material_chunks USING hnsw (embedding vector_ip_ops);
CREATE INDEX IF NOT EXISTS idx_concepts_hnsw ON concepts USING hnsw (embedding vector_ip_ops);

-- 2. Tighten RLS policies (Explicit WITH CHECK for Inserts/Updates)
-- This prevents a malicious user from attempting to INSERT a row with another user's ID.

-- Concepts
DROP POLICY IF EXISTS "Users access own concepts" ON concepts;
CREATE POLICY "Users access own concepts" ON concepts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Revision Cards
DROP POLICY IF EXISTS "Users access own revision_cards" ON revision_cards;
CREATE POLICY "Users access own revision_cards" ON revision_cards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Material Chunks
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own materials" ON materials;
CREATE POLICY "Users access own materials" ON materials 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own material chunks" ON material_chunks;
CREATE POLICY "Users access own material chunks" ON material_chunks 
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
