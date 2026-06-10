-- 20260529000010_upgrade_vector_indexes_to_hnsw.sql
-- HNSW is significantly more scalable for high-concurrency vector searches.

-- 1. Drop existing ivfflat indexes
DROP INDEX IF EXISTS idx_chat_memory_embedding;
DROP INDEX IF EXISTS idx_material_chunks_embedding;
-- 2. Create new hnsw indexes
CREATE INDEX IF NOT EXISTS idx_chat_memory_embedding_hnsw 
ON chat_memory USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_material_chunks_embedding_hnsw 
ON material_chunks USING hnsw (embedding vector_cosine_ops);
