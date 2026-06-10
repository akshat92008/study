-- supabase/migrations/20260529000001_fix_schema_runtime_mismatch.sql
-- SAFETY-NET: Renames wrong-named tables to what the runtime code expects.
-- Run this ONLY if 20260528000001_initial_schema.sql was already applied with wrong names.
-- This migration is idempotent — safe to run even if tables were already correct.

-- ── Fix 1: events → student_events ──────────────────────────────────────────
DO $$
BEGIN
  -- Rename if wrong table exists and correct one does not
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_events' AND table_schema = 'public')
  THEN
    ALTER TABLE public.events RENAME TO student_events;
    -- Also rename the self-referential FK index/constraint if present
    RAISE NOTICE 'Renamed events → student_events';
  END IF;
END $$;
-- ── Fix 2: event_consumers → event_consumer_tracking ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_consumers' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_consumer_tracking' AND table_schema = 'public')
  THEN
    ALTER TABLE public.event_consumers RENAME TO event_consumer_tracking;
    RAISE NOTICE 'Renamed event_consumers → event_consumer_tracking';
  END IF;
END $$;
-- ── Fix 3: event_dead_letter → dlq_events ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_dead_letter' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dlq_events' AND table_schema = 'public')
  THEN
    ALTER TABLE public.event_dead_letter RENAME TO dlq_events;
    RAISE NOTICE 'Renamed event_dead_letter → dlq_events';
  END IF;
END $$;
-- ── Fix 4: study_tasks column renames ───────────────────────────────────────
DO $$
BEGIN
  -- scheduled_for → scheduled_date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'scheduled_for' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'scheduled_date' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_tasks RENAME COLUMN scheduled_for TO scheduled_date;
    RAISE NOTICE 'Renamed study_tasks.scheduled_for → scheduled_date';
  END IF;

  -- category → type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'category' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'type' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_tasks RENAME COLUMN category TO type;
    RAISE NOTICE 'Renamed study_tasks.category → type';
  END IF;
END $$;
-- ── Fix 5: Add missing study_tasks columns if absent ────────────────────────
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS is_completed boolean default false;
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS notes text;
-- ── Fix 6: Add missing student_events columns ────────────────────────────────
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS retry_count int default 0;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS trace_id uuid default gen_random_uuid();
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS version text default 'v2';
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS metadata jsonb default '{}'::jsonb;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS status text default 'pending';
-- ── Fix 7: Add missing event_consumer_tracking columns ───────────────────────
ALTER TABLE public.event_consumer_tracking ADD COLUMN IF NOT EXISTS retry_count int default 0;
ALTER TABLE public.event_consumer_tracking ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.event_consumer_tracking ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();
-- ── Fix 8: Create dlq_events if completely missing ───────────────────────────
CREATE TABLE IF NOT EXISTS public.dlq_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  trace_id uuid,
  version text,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  error_message text NOT NULL DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text
);
ALTER TABLE public.dlq_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dlq_events' AND policyname = 'Service role full access dlq'
  ) THEN
    CREATE POLICY "Service role full access dlq" ON public.dlq_events FOR ALL USING (true);
  END IF;
END $$;
-- ── Fix 9: match_chat_memory RPC — point to chat_memory not chat_memory_embeddings ──
-- The runtime writes to `chat_memory` (chatMemoryService.ts) so the RPC must read from `chat_memory`.
-- Drop old version that pointed to chat_memory_embeddings.
DROP FUNCTION IF EXISTS public.match_chat_memory(vector, float, int, uuid);
DROP FUNCTION IF EXISTS public.match_chat_memory(vector(768), float, int, uuid);
CREATE OR REPLACE FUNCTION public.match_chat_memory(
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If chat_memory table exists, search it; otherwise fall back gracefully
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory' AND table_schema = 'public') THEN
    RETURN QUERY
    SELECT
      cm.id,
      cm.content,
      1 - (cm.embedding <=> query_embedding) AS similarity
    FROM public.chat_memory cm
    WHERE
      cm.user_id = p_user_id
      AND cm.embedding IS NOT NULL
      AND 1 - (cm.embedding <=> query_embedding) > match_threshold
    ORDER BY cm.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory_embeddings' AND table_schema = 'public') THEN
    -- Legacy fallback
    RETURN QUERY
    SELECT
      cme.id,
      cme.content,
      1 - (cme.embedding <=> query_embedding) AS similarity
    FROM public.chat_memory_embeddings cme
    WHERE
      cme.user_id = p_user_id
      AND cme.embedding IS NOT NULL
      AND 1 - (cme.embedding <=> query_embedding) > match_threshold
    ORDER BY cme.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.match_chat_memory(vector(768), float, int, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_chat_memory(vector(768), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_chat_memory(vector(768), float, int, uuid) TO service_role;
-- ── Fix 10: Ensure event_consumer_tracking RLS exists ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_consumer_tracking' AND policyname = 'Service role full access consumers'
  ) THEN
    ALTER TABLE public.event_consumer_tracking ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access consumers"
      ON public.event_consumer_tracking FOR ALL USING (true);
  END IF;
END $$;
