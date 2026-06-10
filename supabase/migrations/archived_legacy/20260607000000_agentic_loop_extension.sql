-- 20260607000000_agentic_loop_extension.sql
-- Extensions for command session versioning and agent activity feed titles

alter table public.agent_actions
  add column if not exists title text;

create table if not exists public.command_session_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.learning_goals(id) on delete cascade,
  session_date date not null,
  version int not null default 1,
  content jsonb not null default '{}'::jsonb,
  adaptation_reason text,
  source_event_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_command_session_versions_user_goal_date
  on public.command_session_versions(user_id, goal_id, session_date);

alter table public.command_session_versions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'command_session_versions' and policyname = 'Users access own command_session_versions'
  ) then
    create policy "Users access own command_session_versions"
      on public.command_session_versions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Ensure practice_sets has goal_id for grounding
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'practice_sets' and column_name = 'goal_id'
  ) then
    alter table public.practice_sets
      add column goal_id uuid references public.learning_goals(id) on delete cascade;
  end if;
end $$;

-- Card proposals and uncertain concepts
alter table public.revision_cards
  add column if not exists origin text default 'manual' check (origin in ('manual', 'chat', 'autopsy', 'practice', 'source')),
  add column if not exists approval_status text default 'approved' check (approval_status in ('approved', 'pending', 'rejected')),
  add column if not exists goal_id uuid references public.learning_goals(id) on delete cascade;

create table if not exists public.unresolved_concept_mentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null default '',
  created_at timestamptz not null default now()
);

alter table public.unresolved_concept_mentions
  add column if not exists goal_id uuid references public.learning_goals(id) on delete cascade,
  add column if not exists topic text not null default '',
  add column if not exists subject text,
  add column if not exists confidence numeric,
  add column if not exists source_type text,
  add column if not exists source_id uuid,
  add column if not exists source_event_id uuid,
  add column if not exists status text not null default 'pending' check (status in ('pending', 'resolved', 'ignored')),
  add column if not exists resolved_concept_id uuid references public.concepts(id) on delete set null;

create index if not exists idx_unresolved_mentions_user_status
  on public.unresolved_concept_mentions(user_id, status);

alter table public.unresolved_concept_mentions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unresolved_concept_mentions' and policyname = 'Users access own unresolved mentions'
  ) then
    create policy "Users access own unresolved mentions"
      on public.unresolved_concept_mentions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Add title field to agent_actions if not present (already handled by alter table if exists but being explicit)
update public.agent_actions
set title = case 
  when agent_name = 'mind' then 'MIND observation'
  when agent_name = 'atlas' then 'ATLAS map update'
  when agent_name = 'memory' then 'MEMORY card created'
  when agent_name = 'planner' then 'PLANNER adapted session'
  when agent_name = 'command' then 'COMMAND mission updated'
  else agent_name || ' action'
end
where title is null;
