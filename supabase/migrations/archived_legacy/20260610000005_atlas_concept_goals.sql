-- Module 9 Phase 9.2: ATLAS Concept Resolution Hardening
-- Add goal_id to concepts for exam-specific tracking and create unique index

ALTER TABLE public.concepts
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE;

-- Drop the old unique index on user/concept_key if it exists
DROP INDEX IF EXISTS idx_concepts_user_concept_key_unique;

-- Create the new canonical unique index: user + goal + concept_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_user_goal_concept_key_unique
  ON public.concepts(user_id, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), concept_key)
  WHERE concept_key IS NOT NULL;
