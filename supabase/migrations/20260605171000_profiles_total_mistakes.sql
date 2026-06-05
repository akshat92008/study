-- Add total_mistakes column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_mistakes integer DEFAULT 0;
