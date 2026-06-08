-- Migration: 20260617000002_mvp_schema_reconciliation.sql
-- Purpose: Final schema reconciliation for Cognition OS MVP.
-- Ensures all runtime-required columns, constraints, and idempotency keys exist.
-- This migration is safe to run on both fresh and existing databases.

DO $$
BEGIN

-- 1. Profiles Reconciliation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exam_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS learner_state_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

-- Drop legacy constraint if it exists
IF EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_name = 'profiles_exam_type_check' AND table_schema = 'public'
) THEN
  ALTER TABLE public.profiles DROP CONSTRAINT profiles_exam_type_check;
END IF;


-- 2. Revision Cards Hardening
ALTER TABLE public.revision_cards ADD COLUMN IF NOT EXISTS normalized_key text;

-- Add unique constraint for revision cards idempotency
IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'revision_cards' AND indexname = 'idx_revision_cards_user_normalized_key'
) THEN
  CREATE UNIQUE INDEX idx_revision_cards_user_normalized_key 
    ON public.revision_cards(user_id, normalized_key) 
    WHERE normalized_key IS NOT NULL;
END IF;


-- 3. Learning Events Hardening
-- Ensure learner_events exists (some legacy DBs might call it something else)
CREATE TABLE IF NOT EXISTS public.learner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  idempotency_key text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.learner_events ADD COLUMN IF NOT EXISTS idempotency_key text;

IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'learner_events' AND indexname = 'idx_learner_events_user_idempotency'
) THEN
  CREATE UNIQUE INDEX idx_learner_events_user_idempotency 
    ON public.learner_events(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
END IF;


-- 4. Session Cards Canonicalization (Reconciliation)
-- This ensures the work from 20260608000000 is present and stable.
ALTER TABLE public.session_cards 
  ADD COLUMN IF NOT EXISTS goal_key UUID 
  GENERATED ALWAYS AS (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

-- Drop old non-canonical unique index if it exists
DROP INDEX IF EXISTS public.idx_session_cards_user_date;

-- Ensure canonical unique constraint
IF NOT EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_name = 'session_cards_canonical_unique' AND table_schema = 'public'
) THEN
  -- Cleanup potential duplicates before applying
  WITH ranked_cards AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, date, goal_key ORDER BY updated_at DESC) as rn
    FROM public.session_cards
  )
  DELETE FROM public.session_cards WHERE id IN (SELECT id FROM ranked_cards WHERE rn > 1);

  ALTER TABLE public.session_cards
    ADD CONSTRAINT session_cards_canonical_unique UNIQUE (user_id, date, goal_key);
END IF;


-- 5. Autopsy Projection & Mistake Hardening
ALTER TABLE public.mistakes ADD COLUMN IF NOT EXISTS idempotency_key text;

IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'mistakes' AND indexname = 'idx_mistakes_user_idempotency'
) THEN
  CREATE UNIQUE INDEX idx_mistakes_user_idempotency 
    ON public.mistakes(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
END IF;

-- Ensure autopsy_reports has the generating/generated_by status
ALTER TABLE public.autopsy_reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'ready';
ALTER TABLE public.autopsy_reports ADD COLUMN IF NOT EXISTS generated_by text DEFAULT 'deterministic';


-- 6. Concepts Mastery Reconciliation
ALTER TABLE public.concepts ADD COLUMN IF NOT EXISTS mastery_score numeric DEFAULT 0;
ALTER TABLE public.concepts ADD COLUMN IF NOT EXISTS forgetting double precision;
ALTER TABLE public.concepts ADD COLUMN IF NOT EXISTS concept_key text;


-- 7. Future-Dated Migration Safety (Hermes / Combined)
-- These tables are expected by the agent runtime. 
-- We ensure they exist with the right types if future migrations haven't run yet.

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  idempotency_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure agent_runs has all required columns for the runtime
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS goal_id uuid;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat';
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS plan jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS mutation_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure unique index on agent_runs idempotency
IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'agent_runs' AND indexname = 'idx_agent_runs_user_idempotency_unique'
) THEN
  CREATE UNIQUE INDEX idx_agent_runs_user_idempotency_unique
    ON public.agent_runs(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
END IF;

END $$;

-- 8. Grants for Service Role
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
