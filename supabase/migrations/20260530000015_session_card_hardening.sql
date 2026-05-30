-- =============================================================================
-- MODULE 5: SESSION CARD HARDENING
-- Migration: 20260530000012_session_card_hardening.sql
-- =============================================================================
-- Adds deterministic-selector columns to session_cards so the API can
-- store and re-hydrate all source signals without an extra DB round-trip.
--
-- Columns added:
--   task_type          – P1-P6 priority bucket
--   resource_type      – how to study (flashcard_review, practice_questions…)
--   target_concept_id  – FK to concepts (nullable for onboarding/goal_sprint)
--   priority           – same as task_type, stored for display
--   is_completed       – true after user finishes the session
--   completed_at       – timestamp of completion
--   selection_reason   – deterministic explanation string
--   mistake_count      – number of recent mistakes at selection time
--   weak_concept_count – number of weak concepts at selection time
--   has_active_goal    – whether a goal was present
--   "taskType"         – camelCase alias (matches existing JS column convention)
--   "resourceType"     – camelCase alias
--   "targetConceptId"  – camelCase alias
--   "isCompleted"      – camelCase alias
--   "completedAt"      – camelCase alias
--   "selectionReason"  – camelCase alias
--   "mistakeCount"     – camelCase alias
--   "weakConceptCount" – camelCase alias
--   "hasActiveGoal"    – camelCase alias
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: New structural columns (snake_case canonical)
-- ---------------------------------------------------------------------------

ALTER TABLE public.session_cards
  ADD COLUMN IF NOT EXISTS task_type          TEXT,
  ADD COLUMN IF NOT EXISTS resource_type      TEXT,
  ADD COLUMN IF NOT EXISTS target_concept_id  UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority           TEXT,
  ADD COLUMN IF NOT EXISTS is_completed       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS mistake_count      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weak_concept_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_active_goal    BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Step 2: camelCase aliases used by the JS ORM layer
-- (The existing schema already has "dayNumber", "streakDays" etc. in quotes;
--  we follow the same convention for new columns.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.session_cards
  ADD COLUMN IF NOT EXISTS "taskType"          TEXT,
  ADD COLUMN IF NOT EXISTS "resourceType"      TEXT,
  ADD COLUMN IF NOT EXISTS "targetConceptId"   UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "isCompleted"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "completedAt"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "selectionReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "mistakeCount"      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weakConceptCount"  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasActiveGoal"     BOOLEAN DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Step 3: Back-fill existing rows with sensible defaults
-- ---------------------------------------------------------------------------

UPDATE public.session_cards
SET
  task_type          = COALESCE(task_type, 'concept_study'),
  resource_type      = COALESCE(resource_type, 'practice_questions'),
  priority           = COALESCE(priority, 'concept_study'),
  "taskType"         = COALESCE("taskType", 'concept_study'),
  "resourceType"     = COALESCE("resourceType", 'practice_questions'),
  is_completed       = COALESCE(is_completed, FALSE),
  "isCompleted"      = COALESCE("isCompleted", FALSE)
WHERE task_type IS NULL OR "taskType" IS NULL;

-- ---------------------------------------------------------------------------
-- Step 4: Index for fast completed-card lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_session_cards_completed
  ON public.session_cards(user_id, date, "isCompleted");

CREATE INDEX IF NOT EXISTS idx_session_cards_concept
  ON public.session_cards("targetConceptId")
  WHERE "targetConceptId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 5: RPC — complete_daily_session_card
-- Marks the session card as completed AND bumps learner_state_version atomically.
-- Called from POST /api/study-sessions or POST /api/dashboard/session-card/complete.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_daily_session_card(
  p_user_id   UUID,
  p_date      DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_updated   INT;
  v_version   INT;
BEGIN
  -- Mark card completed
  UPDATE public.session_cards
  SET
    "isCompleted"  = TRUE,
    "completedAt"  = NOW(),
    is_completed   = TRUE,
    completed_at   = NOW()
  WHERE user_id = p_user_id
    AND date    = p_date
    AND ("isCompleted" = FALSE OR "isCompleted" IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Bump learner state version so tomorrow's card regenerates with fresh signals
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- Step 6: RPC — invalidate_session_card
-- Deletes today + tomorrow session_cards and bumps version.
-- Safe to call from edge functions / workers without TS import.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invalidate_session_card(
  p_user_id UUID,
  p_reason  TEXT DEFAULT 'manual_invalidation'
) RETURNS JSONB AS $$
DECLARE
  v_version INT;
  v_deleted INT := 0;
BEGIN
  -- Delete today and tomorrow
  DELETE FROM public.session_cards
  WHERE user_id = p_user_id
    AND date IN (CURRENT_DATE, CURRENT_DATE + 1);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Bump version
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'deleted', v_deleted,
    'newVersion', v_version,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.invalidate_session_card(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.invalidate_session_card(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Step 7: Ensure unique constraint on (user_id, date) — defensive
-- (Already added in 20260529000004 but may be missing on older DBs)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_cards_user_id_date_key'
      AND conrelid = 'public.session_cards'::regclass
  ) THEN
    ALTER TABLE public.session_cards ADD CONSTRAINT session_cards_user_id_date_key
      UNIQUE (user_id, date);
  END IF;
END $$;
