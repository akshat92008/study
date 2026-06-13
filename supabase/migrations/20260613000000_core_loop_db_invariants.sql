-- Migration: Enforce Core Loop Invariants

-- 1. session_cards unique index: user_id + date + coalesce(goal_id, zero_uuid)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_cards_user_date_goal 
ON public.session_cards (user_id, date, coalesce(goal_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. revision_cards must support concept_id FK.
ALTER TABLE public.revision_cards
ADD COLUMN IF NOT EXISTS concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL;

-- 3. learner_events must require user_id, created_at
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'learner_events') THEN
    ALTER TABLE public.learner_events
      ALTER COLUMN user_id SET NOT NULL,
      ALTER COLUMN created_at SET NOT NULL;
  END IF;
END $$;


-- 4. autopsy_diagnoses must not use placeholder concept labels
CREATE TABLE IF NOT EXISTS public.autopsy_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  CONSTRAINT valid_topic_check CHECK (
    topic NOT IN ('unknown', 'n/a', 'not applicable', 'none', 'unspecified', 'undefined', 'null', '')
  )
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'autopsy_diagnoses') THEN
    ALTER TABLE public.autopsy_diagnoses 
      DROP CONSTRAINT IF EXISTS valid_topic_check;
    ALTER TABLE public.autopsy_diagnoses 
      ADD CONSTRAINT valid_topic_check CHECK (
        topic NOT IN ('unknown', 'n/a', 'not applicable', 'none', 'unspecified', 'undefined', 'null', '')
      );
  END IF;
END $$;

-- 5. RLS must prevent cross-user reading/writing
-- For session_cards
ALTER TABLE public.session_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own session_cards" ON public.session_cards;
CREATE POLICY "Users access own session_cards" ON public.session_cards FOR ALL USING (auth.uid() = user_id);

-- For learner_events
ALTER TABLE public.learner_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own learner_events" ON public.learner_events;
CREATE POLICY "Users access own learner_events" ON public.learner_events FOR ALL USING (auth.uid() = user_id);

-- For revision_cards
ALTER TABLE public.revision_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own revision_cards" ON public.revision_cards;
CREATE POLICY "Users access own revision_cards" ON public.revision_cards FOR ALL USING (auth.uid() = user_id);

-- For autopsy_diagnoses
ALTER TABLE public.autopsy_diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own autopsy_diagnoses" ON public.autopsy_diagnoses;
CREATE POLICY "Users access own autopsy_diagnoses" ON public.autopsy_diagnoses FOR ALL USING (auth.uid() = user_id);
