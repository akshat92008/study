-- Add preset_id to learning_goals for universal domain presets
ALTER TABLE public.learning_goals
ADD COLUMN IF NOT EXISTS preset_id text;
-- Backfill preset_id based on existing exam_type
UPDATE public.learning_goals
SET preset_id = CASE
  WHEN lower(exam_type) LIKE '%neet%' THEN 'neet_ug'
  WHEN lower(exam_type) LIKE '%jee%' THEN 'jee_main'
  ELSE 'competitive_exam_generic'
END
WHERE preset_id IS NULL AND exam_type IS NOT NULL;
