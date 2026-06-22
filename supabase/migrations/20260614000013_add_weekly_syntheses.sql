-- Migration to add weekly_syntheses table for cross-session synthesis narrative

CREATE TABLE IF NOT EXISTS public.weekly_syntheses (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date date NOT NULL,
    narrative_text text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS weekly_syntheses_user_id_idx ON public.weekly_syntheses(user_id);
CREATE INDEX IF NOT EXISTS weekly_syntheses_user_week_idx ON public.weekly_syntheses(user_id, week_start_date);
CREATE UNIQUE INDEX IF NOT EXISTS weekly_syntheses_user_week_unique ON public.weekly_syntheses(user_id, week_start_date);

-- Trigger for updated_at
CREATE TRIGGER weekly_syntheses_updated_at BEFORE UPDATE ON public.weekly_syntheses
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.weekly_syntheses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "weekly_syntheses_select_own" ON public.weekly_syntheses;
CREATE POLICY "weekly_syntheses_select_own"
  ON public.weekly_syntheses FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.weekly_syntheses TO authenticated;
