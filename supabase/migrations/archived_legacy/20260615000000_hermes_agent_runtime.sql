-- Hermes-class agent runtime tables for Cognition OS
-- Author: Claude Code implementation
-- Phase 1: Core agent trajectory infrastructure

-- ============================================================
-- A. agent_learning_signals table
-- Persisted learning signals produced by the agent runtime
-- ============================================================
create table if not exists public.agent_learning_signals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid null references public.agent_runs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  source text not null default 'cognition_runtime',
  signal_type text not null,
  concept_id uuid null,
  concept_name text null,
  confidence numeric not null default 0,
  evidence text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_learning_signals_user_created
  on public.agent_learning_signals(user_id, created_at desc);
create index if not exists idx_agent_learning_signals_run
  on public.agent_learning_signals(run_id);
create index if not exists idx_agent_learning_signals_concept
  on public.agent_learning_signals(concept_id);
create index if not exists idx_agent_learning_signals_signal_type
  on public.agent_learning_signals(signal_type);

alter table public.agent_learning_signals enable row level security;
drop policy if exists "agent_learning_signals_select_own" on public.agent_learning_signals;
create policy "agent_learning_signals_select_own"
  on public.agent_learning_signals for select using (auth.uid() = user_id);
drop policy if exists "agent_learning_signals_insert_own" on public.agent_learning_signals;
create policy "agent_learning_signals_insert_own"
  on public.agent_learning_signals for insert with check (auth.uid() = user_id);

-- ============================================================
-- B. agent_steps table
-- Step-by-step execution trace for each agent run
-- ============================================================
create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_index int not null,
  step_type text not null check (step_type in (
    'observe', 'plan', 'tool_call', 'tool_result', 'verify',
    'respond', 'background_review', 'skill_match', 'skill_write'
  )),
  role text null,
  content jsonb not null default '{}'::jsonb,
  model text null,
  token_usage jsonb null,
  created_at timestamptz not null default now()
);

-- No unique constraint on step_index per run to allow multiple steps of same type
-- Unique by run_id + (step_index + step_type) for ordering
create unique index if not exists idx_agent_steps_run_index
  on public.agent_steps(run_id, step_index, step_type);
create index if not exists idx_agent_steps_user_created
  on public.agent_steps(user_id, created_at desc);

alter table public.agent_steps enable row level security;
drop policy if exists "agent_steps_select_own" on public.agent_steps;
create policy "agent_steps_select_own"
  on public.agent_steps for select using (auth.uid() = user_id);
drop policy if exists "agent_steps_insert_own" on public.agent_steps;
create policy "agent_steps_insert_own"
  on public.agent_steps for insert with check (auth.uid() = user_id);

-- ============================================================
-- C. agent_tool_calls table
-- Durable pre/post tool call logging
-- ============================================================
create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  step_id uuid null references public.agent_steps(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  tool_name text not null,
  toolset text null,
  args jsonb not null default '{}'::jsonb,
  result jsonb null,
  status text not null default 'started' check (status in (
    'started', 'success', 'failed', 'blocked', 'approval_required'
  )),
  mutating boolean not null default false,
  idempotent boolean not null default true,
  risk_level text not null default 'safe_read',
  entity_type text null,
  entity_ids text[] null,
  changed boolean not null default false,
  verification jsonb not null default '{}'::jsonb,
  error jsonb null,
  duration_ms int null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists idx_agent_tool_calls_run_started
  on public.agent_tool_calls(run_id, started_at);
create index if not exists idx_agent_tool_calls_user_started
  on public.agent_tool_calls(user_id, started_at desc);
create index if not exists idx_agent_tool_calls_tool_name
  on public.agent_tool_calls(tool_name);
create index if not exists idx_agent_tool_calls_status
  on public.agent_tool_calls(status);

alter table public.agent_tool_calls enable row level security;
drop policy if exists "agent_tool_calls_select_own" on public.agent_tool_calls;
create policy "agent_tool_calls_select_own"
  on public.agent_tool_calls for select using (auth.uid() = user_id);
drop policy if exists "agent_tool_calls_insert_own" on public.agent_tool_calls;
create policy "agent_tool_calls_insert_own"
  on public.agent_tool_calls for insert with check (auth.uid() = user_id);

-- ============================================================
-- D. agent_verifications table
-- Verification records for mutating tool calls
-- ============================================================
create table if not exists public.agent_verifications (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  tool_call_id uuid null references public.agent_tool_calls(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  verification_type text not null,
  entity_type text null,
  entity_id text null,
  expected jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,
  success boolean not null default false,
  summary text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_verifications_run
  on public.agent_verifications(run_id);
create index if not exists idx_agent_verifications_tool_call
  on public.agent_verifications(tool_call_id);
create index if not exists idx_agent_verifications_user_created
  on public.agent_verifications(user_id, created_at desc);

alter table public.agent_verifications enable row level security;
drop policy if exists "agent_verifications_select_own" on public.agent_verifications;
create policy "agent_verifications_select_own"
  on public.agent_verifications for select using (auth.uid() = user_id);
drop policy if exists "agent_verifications_insert_own" on public.agent_verifications;
create policy "agent_verifications_insert_own"
  on public.agent_verifications for insert with check (auth.uid() = user_id);

-- ============================================================
-- E. agent_skills table
-- Durable skill registry for procedural learning repair patterns
-- ============================================================
create table if not exists public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  goal_id uuid null,
  concept_id uuid null,
  scope text not null default 'user' check (scope in ('global', 'user', 'goal', 'concept')),
  name text not null,
  description text null,
  trigger jsonb not null default '{}'::jsonb,
  procedure text not null,
  source_run_id uuid null references public.agent_runs(id) on delete set null,
  source_event_id uuid null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived', 'disabled')),
  success_count int not null default 0,
  failure_count int not null default 0,
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_skills_user
  on public.agent_skills(user_id);
create index if not exists idx_agent_skills_goal
  on public.agent_skills(goal_id) where goal_id is not null;
create index if not exists idx_agent_skills_concept
  on public.agent_skills(concept_id) where concept_id is not null;
create index if not exists idx_agent_skills_status
  on public.agent_skills(status);
create index if not exists idx_agent_skills_scope
  on public.agent_skills(scope);

alter table public.agent_skills enable row level security;
drop policy if exists "agent_skills_select_own" on public.agent_skills;
create policy "agent_skills_select_own"
  on public.agent_skills for select using (auth.uid() = user_id or scope = 'global');
drop policy if exists "agent_skills_insert_own" on public.agent_skills;
create policy "agent_skills_insert_own"
  on public.agent_skills for insert with check (auth.uid() = user_id or scope = 'global');

-- ============================================================
-- F. Update agent_runs table with new columns
-- Add missing columns from canonical spec
-- ============================================================
alter table public.agent_runs
  add column if not exists goal_id uuid null,
  add column if not exists conversation_id text null,
  add column if not exists session_id text null,
  add column if not exists event_id uuid null,
  add column if not exists source_event_id text null,
  add column if not exists channel text not null default 'chat',
  add column if not exists observation jsonb not null default '{}'::jsonb,
  add column if not exists context_summary jsonb not null default '{}'::jsonb,
  add column if not exists source_summary jsonb not null default '{}'::jsonb,
  add column if not exists plan jsonb not null default '{}'::jsonb,
  add column if not exists learning_signals jsonb not null default '[]'::jsonb,
  add column if not exists mutation_summary jsonb not null default '{}'::jsonb,
  add column if not exists verification jsonb not null default '{}'::jsonb,
  add column if not exists final_response_summary text null,
  add column if not exists next_recommended_action jsonb null,
  add column if not exists model text null,
  add column if not exists max_iterations int not null default 6,
  add column if not exists used_iterations int not null default 0,
  add column if not exists max_tool_calls int not null default 12,
  add column if not exists used_tool_calls int not null default 0,
  add column if not exists warnings jsonb not null default '[]'::jsonb;

-- Update the existing agent_name check constraint to include 'cognition_runtime'
alter table public.agent_runs
  drop constraint if exists agent_runs_agent_name_check;
alter table public.agent_runs
  add constraint agent_runs_agent_name_check
  check (agent_name in (
    'mind', 'rag', 'atlas', 'memory', 'autopsy', 'planner',
    'pulse', 'command', 'system', 'cognition_runtime'
  ));

-- Update the unique constraint to be just user_id + idempotency_key (removing agent_name)
-- First drop existing unique constraint if it has agent_name in it
alter table public.agent_runs
  drop constraint if exists agent_runs_user_id_agent_name_idempotency_key_key;
-- The spec says unique(user_id, idempotency_key) - re-add without agent_name column
-- We need to do this carefully since there may be existing duplicates
-- Add a new unique index instead
drop index if exists idx_agent_runs_user_idempotency_unique;
create unique index if not exists idx_agent_runs_user_idempotency_unique
  on public.agent_runs(user_id, idempotency_key);

-- Add missing indexes
drop index if exists idx_agent_runs_goal_id;
create index if not exists idx_agent_runs_goal_id
  on public.agent_runs(goal_id) where goal_id is not null;
drop index if exists idx_agent_runs_channel;
create index if not exists idx_agent_runs_channel
  on public.agent_runs(user_id, channel, created_at desc);
drop index if exists idx_agent_runs_event_id;
create index if not exists idx_agent_runs_event_id
  on public.agent_runs(event_id) where event_id is not null;

-- ============================================================
-- G. Source chunk content column compliance
-- Ensure study_material_chunks has canonical content column
-- Note: This should already exist from prior migrations, but add safety
-- ============================================================
do $$
begin
  -- If content column doesn't exist, add it
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'study_material_chunks' and column_name = 'content'
  ) then
    alter table public.study_material_chunks add column content text null;
    raise notice 'Added study_material_chunks.content column';
  end if;

  -- Backfill content from text if content is null and text exists
  if exists (
    select 1 from information_schema.columns
    where table_name = 'study_material_chunks' and column_name = 'text'
  ) then
    update public.study_material_chunks
    set content = text
    where content is null and text is not null;
    raise notice 'Backfilled content from text in study_material_chunks';
  end if;
end
$$;

-- ============================================================
-- H. Service role for agent tables (for server-side operations)
-- ============================================================
grant select, insert, update on public.agent_learning_signals to service_role;
grant select, insert, update on public.agent_steps to service_role;
grant select, insert, update on public.agent_tool_calls to service_role;
grant select, insert, update on public.agent_verifications to service_role;
grant select, insert, update on public.agent_skills to service_role;
grant select, update on public.agent_runs to service_role;

-- ============================================================
-- I. Updated_at trigger for agent_skills
-- ============================================================
drop trigger if exists agent_skills_updated_at on public.agent_skills;
create trigger agent_skills_updated_at before update on public.agent_skills
  for each row execute function update_updated_at();