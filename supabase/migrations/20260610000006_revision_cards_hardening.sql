-- Module 10 Phase 10.1: Revision Cards Hardening
-- Add goal_id and status to revision_cards

ALTER TABLE public.revision_cards
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source_event_id UUID;

-- Drop the old unique index that didn't include goal_id
DROP INDEX IF EXISTS idx_revision_cards_user_normalized_key;

-- Create the new canonical unique index: user + goal + concept + normalized_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_revision_cards_user_goal_concept_key_unique
  ON public.revision_cards(user_id, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(concept_id, '00000000-0000-0000-0000-000000000000'::uuid), normalized_key)
  WHERE normalized_key IS NOT NULL AND status = 'active';

-- Ensure normalized_key is computed via trigger if missing? 
-- The engine layer already computes it, but we can make it NOT NULL down the line. 
