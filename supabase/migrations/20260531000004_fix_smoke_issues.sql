-- Migration: 20260531000004_fix_smoke_issues.sql
-- Purpose: Fix issues found during MVP smoke testing

-- 1. Add missing emotional_state column to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS emotional_state TEXT;

-- 2. Fix the default value of exam_type to comply with the check constraint
ALTER TABLE public.profiles
  ALTER COLUMN exam_type SET DEFAULT 'neet';

-- Ensure any existing uppercase 'NEET' is fixed so check constraints pass
UPDATE public.profiles
  SET exam_type = 'neet'
  WHERE exam_type = 'NEET';
