-- Phase 3: Database Hardening
-- Ensure goal-scoped resources cannot leak across users using a composite foreign key.

-- 1. Add a unique constraint on learning_goals to support the composite FK
ALTER TABLE public.learning_goals ADD CONSTRAINT learning_goals_id_user_id_key UNIQUE (id, user_id);
-- 2. Add composite foreign keys to all tables that have both goal_id and user_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'study_tasks',
      'session_cards',
      'daily_plans',
      'chat_sessions',
      'study_materials',
      'revision_cards',
      'concepts',
      'mistakes',
      'mock_autopsies',
      'autopsy_jobs',
      'autopsy_questions',
      'practice_sets',
      'daily_microtasks'
    ])
  LOOP
    -- Only add if the table actually exists (some might be from different phases)
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I_goal_user_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.learning_goals(id, user_id)',
        t, t
      );
    END IF;
  END LOOP;
END
$$;
