-- Module 9 Phase 9.1: ATLAS Concept Mastery Engine Hardening
-- Add last_updated_reason and evidence_count to concepts for explainability

ALTER TABLE public.concepts 
  ADD COLUMN IF NOT EXISTS last_updated_reason text,
  ADD COLUMN IF NOT EXISTS evidence_count integer not null default 0;
