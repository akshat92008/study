-- supabase/migrations/20260529000009_semantic_memory_hybrid_scores.sql

-- 1. Safely rename chat_memory_embeddings if it exists and chat_memory does not
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory_embeddings' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory' AND table_schema = 'public')
  THEN
    ALTER TABLE public.chat_memory_embeddings RENAME TO chat_memory;
    RAISE NOTICE 'Renamed chat_memory_embeddings → chat_memory';
  END IF;
END $$;
-- 2. Ensure chat_memory actually exists (fallback if initial schema somehow missed it)
CREATE TABLE IF NOT EXISTS public.chat_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid references chat_sessions(id) on delete set null,
  content text not null,
  summary text,
  embedding vector(768),
  importance float default 0.5,
  memory_type text default 'episodic' check (memory_type in ('episodic','semantic','procedural')),
  created_at timestamptz default now()
);
-- 3. Add hybrid scoring columns
ALTER TABLE public.chat_memory
ADD COLUMN IF NOT EXISTS novelty_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emotional_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS learning_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repetition_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS importance_score numeric(4,2) DEFAULT 0;
