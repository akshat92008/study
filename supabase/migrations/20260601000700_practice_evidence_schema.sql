-- supabase/migrations/20260601000700_practice_evidence_schema.sql

CREATE TABLE IF NOT EXISTS public.practice_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_session_id UUID NULL,
    message_id UUID NULL,
    topic TEXT NOT NULL,
    subject TEXT NULL,
    exam_type TEXT NULL,
    set_type TEXT NOT NULL CHECK (set_type IN ('mcq', 'flashcard')),
    source TEXT NOT NULL DEFAULT 'mind',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for looking up sets by message_id
CREATE INDEX IF NOT EXISTS idx_practice_sets_message_id ON public.practice_sets (message_id);
CREATE INDEX IF NOT EXISTS idx_practice_sets_user_id ON public.practice_sets (user_id);

CREATE TABLE IF NOT EXISTS public.practice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_set_id UUID NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id UUID NULL,
    concept_name TEXT NULL,
    question TEXT NOT NULL,
    options JSONB NULL,
    correct_answer TEXT NULL,
    explanation TEXT NULL,
    difficulty TEXT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_items_set_id ON public.practice_items (practice_set_id);
CREATE INDEX IF NOT EXISTS idx_practice_items_user_id ON public.practice_items (user_id);

CREATE TABLE IF NOT EXISTS public.practice_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    practice_set_id UUID NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
    practice_item_id UUID NOT NULL REFERENCES public.practice_items(id) ON DELETE CASCADE,
    answer TEXT NULL,
    is_correct BOOLEAN NULL,
    confidence TEXT NULL CHECK (confidence IN ('easy', 'medium', 'hard', 'forgot', 'knew')),
    time_taken_seconds INT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_id ON public.practice_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_item_id ON public.practice_attempts (practice_item_id);

-- Enable RLS
ALTER TABLE public.practice_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for practice_sets
CREATE POLICY "Users can manage their own practice sets"
ON public.practice_sets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for practice_items
CREATE POLICY "Users can manage their own practice items"
ON public.practice_items
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for practice_attempts
CREATE POLICY "Users can manage their own practice attempts"
ON public.practice_attempts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
