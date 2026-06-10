-- Add goal_type to profiles and learning_goals for universal goal support
-- exam_type remains as a backward-compatibility column

-- 1. Add goal_type to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS goal_type text;
-- 2. Add goal_type to learning_goals
ALTER TABLE public.learning_goals
ADD COLUMN IF NOT EXISTS goal_type text;
-- 3. Backfill goal_type based on existing exam_type
UPDATE public.profiles
SET goal_type = exam_type
WHERE goal_type IS NULL AND exam_type IS NOT NULL;
UPDATE public.learning_goals
SET goal_type = exam_type
WHERE goal_type IS NULL AND exam_type IS NOT NULL;
