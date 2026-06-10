CREATE TABLE IF NOT EXISTS public.learning_state_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  tool_name text,
  event_type text,
  concept_id uuid references public.concepts(id) on delete set null,
  before_state jsonb default '{}'::jsonb,
  after_state jsonb default '{}'::jsonb,
  diff_summary jsonb default '{}'::jsonb,
  policy_decision text,
  created_at timestamptz default now()
);

-- RLS
ALTER TABLE public.learning_state_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning state changes" 
  ON public.learning_state_changes 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- System bypass or Service Role insert
CREATE POLICY "Service Role full access to learning_state_changes"
  ON public.learning_state_changes
  USING (true)
  WITH CHECK (true);
