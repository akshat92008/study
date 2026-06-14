-- Migration to add source-goal mismatch detection persistence fields to study_materials

ALTER TABLE study_materials
ADD COLUMN detected_subject text,
ADD COLUMN detected_chapter text,
ADD COLUMN goal_match_score integer,
ADD COLUMN mismatch_warning_acknowledged boolean DEFAULT false;

-- Add index to quickly query for mismatch warnings
CREATE INDEX IF NOT EXISTS idx_study_materials_mismatch_warning
ON study_materials(mismatch_warning_acknowledged)
WHERE goal_match_score < 50; -- Arbitrary threshold, we can adjust logic in code
