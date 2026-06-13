-- Core-loop production invariants: active goal, idempotency, traces, and data quality.

alter table public.profiles
  add column if not exists active_goal_id uuid references public.learning_goals(id) on delete set null;

alter table public.assessments drop constraint if exists assessments_status_check;
alter table public.assessments
  add constraint assessments_status_check check (status in (
    'draft', 'uploaded', 'parsing', 'parsing_failed', 'extracting', 'needs_review',
    'answers_pending', 'parsed', 'diagnosis_ready', 'diagnosing', 'diagnosis_pending',
    'diagnosis_failed', 'report_generating', 'report_ready', 'projected',
    'projection_failed', 'completed_clean', 'failed'
  ));

create index if not exists idx_profiles_active_goal_id
  on public.profiles(active_goal_id)
  where active_goal_id is not null;

create or replace function public.enforce_profile_active_goal_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active_goal_id is not null and not exists (
    select 1
    from public.learning_goals goal
    where goal.id = new.active_goal_id
      and goal.user_id = new.id
  ) then
    raise exception 'active_goal_id must reference a goal owned by the profile user'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_active_goal_ownership on public.profiles;
create trigger profiles_active_goal_ownership
before insert or update of active_goal_id on public.profiles
for each row execute function public.enforce_profile_active_goal_ownership();

alter table public.practice_sets
  add column if not exists idempotency_key text;

create unique index if not exists practice_sets_user_idempotency_unique
  on public.practice_sets(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.concepts
  drop constraint if exists concepts_canonical_name_not_blank;
alter table public.concepts
  add constraint concepts_canonical_name_not_blank
  check (length(btrim(name)) > 0) not valid;

create table if not exists public.core_loop_traces (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid references public.learning_goals(id) on delete set null,
  action text not null,
  status text not null check (status in ('success', 'failed')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  steps jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_core_loop_traces_user_created
  on public.core_loop_traces(user_id, created_at desc);
create index if not exists idx_core_loop_traces_failed
  on public.core_loop_traces(status, created_at desc)
  where status = 'failed';

alter table public.core_loop_traces enable row level security;

drop policy if exists "Users read own core loop traces" on public.core_loop_traces;
create policy "Users read own core loop traces"
  on public.core_loop_traces for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own core loop traces" on public.core_loop_traces;
create policy "Users insert own core loop traces"
  on public.core_loop_traces for insert
  with check (auth.uid() = user_id);
