-- Private-beta loop closure: chat-first COMMAND plans, outcome API support,
-- prompt audit metadata, and fuller onboarding profile fields.

alter table public.profiles
  add column if not exists daily_hours_available numeric,
  add column if not exists daily_hours numeric,
  add column if not exists subjects jsonb not null default '[]'::jsonb,
  add column if not exists current_level text,
  add column if not exists target_score numeric;
create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_date date not null,
  status text not null default 'completed',
  morning_briefing text,
  summary jsonb not null default '{}'::jsonb,
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, plan_date)
);
alter table public.daily_plans enable row level security;
do $$
begin
  drop policy if exists "Users access own daily_plans" on public.daily_plans;
  create policy "Users access own daily_plans"
    on public.daily_plans for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
end $$;
create index if not exists idx_daily_plans_user_date
  on public.daily_plans(user_id, plan_date desc);
alter table public.ai_usage_events
  add column if not exists prompt_family text,
  add column if not exists prompt_source text,
  add column if not exists prompt_version text;
create index if not exists idx_ai_usage_events_prompt_family
  on public.ai_usage_events(user_id, prompt_family, created_at desc);
