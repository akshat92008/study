-- Phase 5: Add Fine-Grained Weak Area Engine Fields

-- 1. Extend concept_mastery table
ALTER TABLE public.concept_mastery
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS unit_slug text,
ADD COLUMN IF NOT EXISTS topic_slug text,
ADD COLUMN IF NOT EXISTS subtopic_slug text,
ADD COLUMN IF NOT EXISTS microskill_slug text,
ADD COLUMN IF NOT EXISTS concept_slug text;

-- Update the unique index for concept_mastery to handle granular topics
-- We want a unique constraint per (user, goal, chapter, topic, subtopic, concept, microskill)
DROP INDEX IF EXISTS concept_mastery_goal_tag_unique;
ALTER TABLE public.concept_mastery DROP CONSTRAINT IF EXISTS concept_mastery_granular_unique;
ALTER TABLE public.concept_mastery ADD CONSTRAINT concept_mastery_granular_unique UNIQUE NULLS NOT DISTINCT (
  user_id, 
  goal_id, 
  chapter_slug, 
  topic_slug, 
  subtopic_slug, 
  concept_slug, 
  microskill_slug
);

-- 2. Extend weak_area_events table
ALTER TABLE public.weak_area_events
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS unit_slug text,
ADD COLUMN IF NOT EXISTS topic_slug text,
ADD COLUMN IF NOT EXISTS subtopic_slug text,
ADD COLUMN IF NOT EXISTS concept_slug text,
ADD COLUMN IF NOT EXISTS microskill_slug text,
ADD COLUMN IF NOT EXISTS error_pattern_slug text,
ADD COLUMN IF NOT EXISTS attempt_id uuid REFERENCES public.tutor_question_attempts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS evidence_count integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS misconception_notes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS display_path text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recommended_action text;

-- 3. Extend tutor_question_attempts
ALTER TABLE public.tutor_question_attempts
ADD COLUMN IF NOT EXISTS taxonomy_path jsonb,
ADD COLUMN IF NOT EXISTS error_patterns jsonb;

-- Drop the old constraint just in case it limits us
ALTER TABLE public.weak_area_events DROP CONSTRAINT IF EXISTS weak_area_events_severity_check;
ALTER TABLE public.weak_area_events ADD CONSTRAINT weak_area_events_severity_check CHECK (severity IN ('low', 'medium', 'high', 'urgent', 'active'));
