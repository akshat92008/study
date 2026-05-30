-- supabase/migrations/20260529000009_semantic_memory_hybrid_scores.sql
ALTER TABLE public.chat_memory
ADD COLUMN IF NOT EXISTS novelty_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emotional_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS learning_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repetition_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS importance_score numeric(4,2) DEFAULT 0;
