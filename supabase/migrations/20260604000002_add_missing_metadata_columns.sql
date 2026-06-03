-- 20260604000002_add_missing_metadata_columns.sql

ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.daily_microtasks
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.learning_goals
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
