-- Add goal_id and chat_session_id to study_tasks
ALTER TABLE public.study_tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_goal_date ON public.study_tasks (user_id, goal_id, scheduled_date);

-- Update study_tasks.type constraint to allow specific types
ALTER TABLE public.study_tasks
  DROP CONSTRAINT IF EXISTS study_tasks_type_check;

ALTER TABLE public.study_tasks
  ADD CONSTRAINT study_tasks_type_check 
  CHECK (type IN ('study', 'revision', 'revise', 'practice', 'mock', 'mock_test', 'break', 'autopsy_recovery', 'review'));

-- session_cards goal-specific uniqueness
ALTER TABLE public.session_cards
  DROP CONSTRAINT IF EXISTS session_cards_user_id_date_key;

DROP INDEX IF EXISTS idx_session_cards_user_date;

CREATE UNIQUE INDEX IF NOT EXISTS session_cards_user_date_global_unique 
  ON public.session_cards (user_id, date) 
  WHERE goal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS session_cards_user_date_goal_unique 
  ON public.session_cards (user_id, date, goal_id) 
  WHERE goal_id IS NOT NULL;

-- daily_plans goal-specific uniqueness
ALTER TABLE public.daily_plans
  DROP CONSTRAINT IF EXISTS daily_plans_user_id_plan_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS daily_plans_user_date_global_unique 
  ON public.daily_plans (user_id, plan_date) 
  WHERE goal_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS daily_plans_user_date_goal_unique 
  ON public.daily_plans (user_id, plan_date, goal_id) 
  WHERE goal_id IS NOT NULL;
