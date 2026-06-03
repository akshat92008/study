-- 20260601082700_daily_microtasks.sql

CREATE TABLE IF NOT EXISTS public.daily_microtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_card_id UUID REFERENCES public.session_cards(id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    title TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- concept, practice, revision, autopsy, mock, custom
    estimated_minutes INT NOT NULL DEFAULT 15,
    target_count INT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, done, skipped
    priority TEXT NOT NULL DEFAULT 'medium',
    source TEXT NOT NULL DEFAULT 'system', -- system, mind, user
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_microtasks_user_date ON public.daily_microtasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_daily_microtasks_session_card ON public.daily_microtasks(session_card_id);

-- Enable RLS
ALTER TABLE public.daily_microtasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own microtasks" ON public.daily_microtasks;
DROP POLICY IF EXISTS "Users can insert their own microtasks" ON public.daily_microtasks;
DROP POLICY IF EXISTS "Users can update their own microtasks" ON public.daily_microtasks;
DROP POLICY IF EXISTS "Users can delete their own microtasks" ON public.daily_microtasks;

CREATE POLICY "Users can view their own microtasks"
    ON public.daily_microtasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own microtasks"
    ON public.daily_microtasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own microtasks"
    ON public.daily_microtasks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own microtasks"
    ON public.daily_microtasks FOR DELETE
    USING (auth.uid() = user_id);
