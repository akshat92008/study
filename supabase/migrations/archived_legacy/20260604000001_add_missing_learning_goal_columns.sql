ALTER TABLE public.learning_goals
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS progress numeric default 0;
