-- MVP production hardening follow-up:
-- - per-call AI usage ledger and daily budget counters
-- - AUTOPSY low-confidence review state and traceability
-- - duplicate prevention for autopsy-derived mistakes/questions

alter table public.ai_usage_daily
  add column if not exists planner_calls int default 0,
  add column if not exists session_card_calls int default 0,
  add column if not exists budget_exceeded_count int default 0;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  route text not null,
  model text not null,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  total_tokens int default 0,
  estimated_cost numeric default 0,
  created_at timestamptz default now()
);

create index if not exists idx_ai_usage_events_user_date
  on public.ai_usage_events(user_id, usage_date desc, created_at desc);

alter table public.ai_usage_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_usage_events' and policyname = 'Users view own ai_usage_events'
  ) then
    create policy "Users view own ai_usage_events"
      on public.ai_usage_events for select
      using (auth.uid() = user_id);
  end if;
end $$;

alter table public.autopsy_questions
  add column if not exists needs_review boolean default false,
  add column if not exists extraction_confidence numeric,
  add column if not exists trace_metadata jsonb default '{}'::jsonb;

create unique index if not exists idx_autopsy_questions_unique_question
  on public.autopsy_questions(autopsy_id, question_number);

alter table public.mistakes
  add column if not exists source_autopsy_id uuid references public.mock_autopsies(id) on delete cascade,
  add column if not exists source_question_number int,
  add column if not exists extraction_confidence numeric;

create unique index if not exists idx_mistakes_unique_autopsy_question
  on public.mistakes(user_id, source_autopsy_id, source_question_number)
  where source_autopsy_id is not null and source_question_number is not null;
