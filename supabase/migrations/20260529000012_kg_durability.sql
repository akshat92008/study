-- supabase/migrations/20260529000012_kg_durability.sql

ALTER TABLE public.concepts
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- Also adding the adaptation_logs table here for Personalization Tracking (Task 7)
CREATE TABLE IF NOT EXISTS public.adaptation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    adaptation_type TEXT NOT NULL, -- e.g. 'struggle_roadmap_adjustment', 'prereq_injection'
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for adaptation_logs
ALTER TABLE public.adaptation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own adaptation logs"
ON public.adaptation_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own adaptation logs"
ON public.adaptation_logs FOR SELECT
USING (auth.uid() = user_id);

-- System service role can do all
CREATE POLICY "Service role adaptation logs all"
ON public.adaptation_logs
USING (true)
WITH CHECK (true);
