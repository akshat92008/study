-- Migration: 20260608000000_session_card_canonical_upsert.sql
-- Purpose: Enforce exactly one canonical daily session card per user/date/goal.
-- Fixes Supabase upsert issues with partial unique indexes and ensures atomic RPCs.

-- 1. Add goal_key generated column for canonical uniqueness
-- Use the "Zero UUID" for null goal_id
ALTER TABLE public.session_cards
  ADD COLUMN IF NOT EXISTS goal_key UUID 
  GENERATED ALWAYS AS (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

-- 2. Clean up duplicate cards before applying constraint
-- (Keeps the most recently updated card for each user/date/goal_key)
WITH ranked_cards AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, date, goal_key 
           ORDER BY updated_at DESC, created_at DESC
         ) as rn
  FROM public.session_cards
)
DELETE FROM public.session_cards
WHERE id IN (SELECT id FROM ranked_cards WHERE rn > 1);

-- 3. Drop existing problematic partial indexes and constraints
ALTER TABLE public.session_cards DROP CONSTRAINT IF EXISTS session_cards_user_id_date_key;
DROP INDEX IF EXISTS public.session_cards_user_date_global_unique;
DROP INDEX IF EXISTS public.session_cards_user_date_goal_unique;
DROP INDEX IF EXISTS public.idx_session_cards_user_date_goal_not_null;

-- 4. Create the canonical unique constraint
ALTER TABLE public.session_cards
  ADD CONSTRAINT session_cards_canonical_unique UNIQUE (user_id, date, goal_key);

-- 5. Create atomic RPC for session card upsert
CREATE OR REPLACE FUNCTION public.upsert_session_card(
  p_row JSONB
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_date DATE;
  v_goal_id UUID;
  v_goal_key UUID;
  v_result JSONB;
BEGIN
  v_user_id := (p_row->>'user_id')::UUID;
  v_date := (p_row->>'date')::DATE;
  v_goal_id := (p_row->>'goal_id')::UUID;
  v_goal_key := COALESCE(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ensure authorized
  IF auth.uid() IS NULL OR auth.uid() <> v_user_id THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  INSERT INTO public.session_cards (
    user_id, date, goal_id, learner_state_version,
    "dayNumber", "streakDays", "focusTopic", subject,
    "estimatedMinutes", rationale, "daysToExam", "overdueCards",
    "masteryPercent", "closingMessage", task_type, resource_type,
    target_concept_id, priority, "taskType", "resourceType",
    "targetConceptId", selection_reason, mistake_count,
    weak_concept_count, has_active_goal, "selectionReason",
    "mistakeCount", "weakConceptCount", "hasActiveGoal",
    "targetMistakeId", "targetRetestId", "repairPhase",
    source_signals, updated_at
  )
  VALUES (
    v_user_id, v_date, v_goal_id, (p_row->>'learner_state_version')::INT,
    (p_row->>'dayNumber')::INT, (p_row->>'streakDays')::INT, p_row->>'focusTopic', p_row->>'subject',
    (p_row->>'estimatedMinutes')::INT, p_row->>'rationale', (p_row->>'daysToExam')::INT, (p_row->>'overdueCards')::INT,
    (p_row->>'masteryPercent')::NUMERIC, p_row->>'closingMessage', p_row->>'task_type', p_row->>'resource_type',
    (p_row->>'target_concept_id')::UUID, p_row->>'priority', p_row->>'taskType', p_row->>'resourceType',
    (p_row->>'targetConceptId')::UUID, p_row->>'selection_reason', (p_row->>'mistake_count')::INT,
    (p_row->>'weak_concept_count')::INT, (p_row->>'has_active_goal')::BOOLEAN, p_row->>'selectionReason',
    (p_row->>'mistakeCount')::INT, (p_row->>'weakConceptCount')::INT, (p_row->>'hasActiveGoal')::BOOLEAN,
    (p_row->>'targetMistakeId')::UUID, (p_row->>'targetRetestId')::UUID, p_row->>'repairPhase',
    COALESCE(p_row->'source_signals', '{}'::jsonb), NOW()
  )
  ON CONFLICT (user_id, date, goal_key) DO UPDATE
  SET
    learner_state_version = EXCLUDED.learner_state_version,
    "dayNumber" = EXCLUDED."dayNumber",
    "streakDays" = EXCLUDED."streakDays",
    "focusTopic" = EXCLUDED."focusTopic",
    subject = EXCLUDED.subject,
    "estimatedMinutes" = EXCLUDED."estimatedMinutes",
    rationale = EXCLUDED.rationale,
    "daysToExam" = EXCLUDED."daysToExam",
    "overdueCards" = EXCLUDED."overdueCards",
    "masteryPercent" = EXCLUDED."masteryPercent",
    "closingMessage" = EXCLUDED."closingMessage",
    task_type = EXCLUDED.task_type,
    resource_type = EXCLUDED.resource_type,
    target_concept_id = EXCLUDED.target_concept_id,
    priority = EXCLUDED.priority,
    "taskType" = EXCLUDED."taskType",
    "resourceType" = EXCLUDED."resourceType",
    "targetConceptId" = EXCLUDED."targetConceptId",
    selection_reason = EXCLUDED.selection_reason,
    mistake_count = EXCLUDED.mistake_count,
    weak_concept_count = EXCLUDED.weak_concept_count,
    has_active_goal = EXCLUDED.has_active_goal,
    "selectionReason" = EXCLUDED."selectionReason",
    "mistakeCount" = EXCLUDED."mistakeCount",
    "weakConceptCount" = EXCLUDED."weakConceptCount",
    "hasActiveGoal" = EXCLUDED."hasActiveGoal",
    "targetMistakeId" = EXCLUDED."targetMistakeId",
    "targetRetestId" = EXCLUDED."targetRetestId",
    "repairPhase" = EXCLUDED."repairPhase",
    source_signals = EXCLUDED.source_signals,
    updated_at = NOW()
  RETURNING to_jsonb(public.session_cards.*) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.upsert_session_card(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_session_card(JSONB) TO authenticated;

-- 6. Update complete_daily_session_card to handle goal_id and use goal_key
CREATE OR REPLACE FUNCTION public.complete_daily_session_card(
  p_user_id   UUID,
  p_goal_id   UUID DEFAULT NULL,
  p_date      DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_updated   INT;
  v_version   INT;
  v_goal_key  UUID;
BEGIN
  v_goal_key := COALESCE(p_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ensure authorized
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  -- Mark card completed
  UPDATE public.session_cards
  SET
    "isCompleted"  = TRUE,
    "completedAt"  = NOW(),
    is_completed   = TRUE,
    completed_at   = NOW(),
    updated_at     = NOW()
  WHERE user_id = p_user_id
    AND date    = p_date
    AND goal_key = v_goal_key
    AND ("isCompleted" = FALSE OR "isCompleted" IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Bump learner state version
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date,
    'goalId', p_goal_id
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, UUID, DATE) TO authenticated;

-- 7. Update invalidate_session_card to handle goal_id and use goal_key
CREATE OR REPLACE FUNCTION public.invalidate_session_card(
  p_user_id UUID,
  p_goal_id UUID DEFAULT NULL,
  p_reason  TEXT DEFAULT 'manual_invalidation'
) RETURNS JSONB AS $$
DECLARE
  v_version INT;
  v_deleted INT := 0;
  v_goal_key UUID;
BEGIN
  v_goal_key := COALESCE(p_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ensure authorized
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  -- Delete today and tomorrow for this user/goal
  DELETE FROM public.session_cards
  WHERE user_id = p_user_id
    AND date IN (CURRENT_DATE, CURRENT_DATE + 1)
    AND goal_key = v_goal_key;

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
    'reason', p_reason,
    'goalId', p_goal_id
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.invalidate_session_card(UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.invalidate_session_card(UUID, UUID, TEXT) TO authenticated;
