-- Run this migration to enable iterative scanning for multi-tenant vector search
-- File: lib/db/migrations/032_vector_iterative_scan.sql

-- Enable iterative HNSW scan for tenant-filtered queries
ALTER SYSTEM SET hnsw.iterative_scan = 'relaxed_order';
SELECT pg_reload_conf();

-- Add user_id to vector indexes for partial index optimization
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_embedding 
ON chat_messages (user_id) 
WHERE embedding IS NOT NULL;

-- Add index for concept queries (used heavily in MIND context)
CREATE INDEX IF NOT EXISTS idx_concepts_user_mastery 
ON concepts (user_id, mastery, created_at);

-- Add index for revision cards due date queries
CREATE INDEX IF NOT EXISTS idx_revision_cards_user_due 
ON revision_cards (user_id, next_review) 
WHERE next_review IS NOT NULL;
