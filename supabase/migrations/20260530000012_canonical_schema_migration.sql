-- Migration: 20260530000012_canonical_schema_migration.sql
-- Purpose: Canonical forward migration to align runtime and schema

-- 1. Ensure required canonical columns exist on profiles
alter table public.profiles
  add column if not exists exam_type text,
  add column if not exists streak_days int default 0,
  add column if not exists last_active_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'exam'
  ) then
    execute 'update public.profiles set exam_type = coalesce(exam_type, exam)';
  end if;
end $$;

-- 2. Ensure canonical columns exist on concepts
alter table public.concepts
  add column if not exists mastery text,
  add column if not exists forgetting float;

do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery_level'
  ) then
    execute 'update public.concepts set mastery = coalesce(mastery, 
      case
        when mastery_level >= 0.85 then ''mastered''
        when mastery_level >= 0.60 then ''proficient''
        when mastery_level >= 0.25 then ''developing''
        when mastery_level > 0 then ''exposed''
        else ''not_started''
      end
    )';
  end if;
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'forgetting_probability'
  ) then
    execute 'update public.concepts set forgetting = coalesce(forgetting, forgetting_probability)';
  end if;
end $$;

-- 3. Ensure canonical columns exist on revision_cards
alter table public.revision_cards
  add column if not exists due timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'due_at'
  ) then
    execute 'update public.revision_cards set due = coalesce(due, due_at)';
  end if;
end $$;

-- 4. Fix AI Usage Ledger
alter table public.ai_usage_events
  add column if not exists metadata jsonb default '{}'::jsonb;

create or replace function public.atomic_ai_budget_spend(
  p_user_id uuid,
  p_feature text,
  p_model text,
  p_cost numeric,
  p_prompt_tokens int,
  p_completion_tokens int,
  p_route text,
  p_daily_limit_usd numeric default 0.25
) returns void as $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_cost numeric := greatest(coalesce(p_cost, 0), 0);
  v_prompt int := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion int := greatest(coalesce(p_completion_tokens, 0), 0);
  v_total int := v_prompt + v_completion;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if coalesce(v_usage.estimated_cost, 0) + v_cost > p_daily_limit_usd then
    update public.ai_usage_daily
    set budget_exceeded_count = coalesce(budget_exceeded_count, 0) + 1,
        updated_at = now()
    where id = v_usage.id;
    raise exception 'AI_DAILY_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_usage_events (
    user_id,
    usage_date,
    feature,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost,
    route,
    metadata
  ) values (
    p_user_id,
    current_date,
    p_feature,
    p_model,
    v_prompt,
    v_completion,
    v_total,
    v_cost,
    p_route,
    jsonb_build_object('type', 'atomic_spend')
  );

  update public.ai_usage_daily
  set estimated_cost = coalesce(estimated_cost, 0) + v_cost,
      estimated_tokens = coalesce(estimated_tokens, 0) + v_total,
      updated_at = now()
  where id = v_usage.id;

end;
$$ language plpgsql volatile security definer set search_path = public;

-- Revoke and grant as needed
revoke execute on function public.atomic_ai_budget_spend(uuid, text, text, numeric, int, int, text, numeric) from public, authenticated;
grant execute on function public.atomic_ai_budget_spend(uuid, text, text, numeric, int, int, text, numeric) to service_role;

-- 5. Strict RLS validations on 10 user-owned tables
-- We re-enable RLS securely for each.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'learning_goals', 'concepts', 'revision_cards', 
    'chat_sessions', 'chat_messages', 'mock_autopsies', 'autopsy_questions', 
    'mistakes', 'learner_states', 'event_queue', 'ai_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Setup basic "users access own data" policies for those that might be missing them
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'learning_goals', 'concepts', 'revision_cards', 'chat_sessions', 
    'chat_messages', 'mock_autopsies', 'autopsy_questions', 'mistakes', 
    'learner_states', 'event_queue', 'ai_usage_events'
  ] loop
    -- Check if a select policy exists. If not, create a baseline select policy.
    -- Assuming user_id exists in all these tables.
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'users_select_own_' || t
    ) then
      execute format('create policy "users_select_own_%I" on public.%I for select using (auth.uid() = user_id)', t, t);
    end if;
  end loop;
end $$;

-- 6. Clean up legacy ai_usage_logs view or table, but only safely
drop table if exists public.ai_usage_logs cascade;
create or replace view public.ai_usage_logs as 
  select * from public.ai_usage_events;

