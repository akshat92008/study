-- Migration to add source-goal mismatch detection persistence fields to study_materials

ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS detected_subject text,
ADD COLUMN IF NOT EXISTS detected_chapter text,
ADD COLUMN IF NOT EXISTS goal_match_score numeric,
ADD COLUMN IF NOT EXISTS mismatch_warning_acknowledged boolean NOT NULL DEFAULT false;

-- Add index to quickly query for mismatch warnings
CREATE INDEX IF NOT EXISTS idx_study_materials_mismatch_warning
ON public.study_materials(mismatch_warning_acknowledged)
WHERE goal_match_score < 0.5;
