-- Native Amaura/Cognition agentic runtime.
-- Keeps Vercel Hobby background work bounded by using the existing
-- event_queue + consumer_locks durable queue.

alter table if exists public.learning_goals
  add column if not exists agentic_status text not null default 'active',
  add column if not exists progress_percent numeric not null default 0,
  add column if not exists risk_level text not null default 'unknown',
  add column if not exists current_state jsonb not null default '{}'::jsonb,
  add column if not exists desired_state jsonb not null default '{}'::jsonb,
  add column if not exists constraints jsonb not null default '{}'::jsonb,
  add column if not exists last_evaluated_at timestamptz null,
  add column if not exists generated_by_agent text null,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.daily_microtasks
  add column if not exists goal_id uuid null references public.learning_goals(id) on delete cascade,
  add column if not exists source_agent text null,
  add column if not exists source_event_id text null,
  add column if not exists dedup_key text null,
  add column if not exists success_criteria jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb,
  add column if not exists adaptation_reason text null,
  add column if not exists scheduled_for timestamptz null,
  add column if not exists due_at timestamptz null,
  add column if not exists skipped_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists daily_microtasks_user_dedup_unique
  on public.daily_microtasks(user_id, dedup_key)
  where dedup_key is not null;

alter table if exists public.learning_evidence
  add column if not exists goal_id uuid null references public.learning_goals(id) on delete cascade,
  add column if not exists task_id uuid null references public.daily_microtasks(id) on delete set null,
  add column if not exists source text null,
  add column if not exists observation_type text null,
  add column if not exists source_event_id text null,
  add column if not exists dedup_key text null;

create unique index if not exists learning_evidence_user_dedup_unique
  on public.learning_evidence(user_id, dedup_key)
  where dedup_key is not null;

create table if not exists public.amaura_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  type text not null,
  priority text not null default 'normal' check (priority in ('silent', 'low', 'normal', 'important', 'urgent')),
  title text not null,
  message text not null,
  action_label text null,
  action_type text null,
  action_payload jsonb null,
  dedup_key text null,
  metadata jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists amaura_notifications_user_read_created_idx
  on public.amaura_notifications(user_id, read, created_at desc);
create index if not exists amaura_notifications_user_type_created_idx
  on public.amaura_notifications(user_id, type, created_at desc);
create unique index if not exists amaura_notifications_user_dedup_unique
  on public.amaura_notifications(user_id, dedup_key)
  where dedup_key is not null;

alter table public.amaura_notifications enable row level security;

drop policy if exists "amaura_notifications_select_own" on public.amaura_notifications;
create policy "amaura_notifications_select_own"
  on public.amaura_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "amaura_notifications_update_own" on public.amaura_notifications;
create policy "amaura_notifications_update_own"
  on public.amaura_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, update on public.amaura_notifications to authenticated;

create table if not exists public.amaura_pattern_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  concept_id uuid null references public.concepts(id) on delete set null,
  subject text null,
  chapter text null,
  topic text null,
  pattern_type text not null,
  pattern text not null,
  occurrences integer not null default 1,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  weight numeric not null default 0.5 check (weight >= 0 and weight <= 1),
  evidence jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'decayed', 'resolved', 'archived')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists amaura_pattern_memories_user_status_seen_idx
  on public.amaura_pattern_memories(user_id, status, last_seen_at desc);
create index if not exists amaura_pattern_memories_user_goal_status_idx
  on public.amaura_pattern_memories(user_id, goal_id, status);
create index if not exists amaura_pattern_memories_user_concept_idx
  on public.amaura_pattern_memories(user_id, concept_id);
create index if not exists amaura_pattern_memories_user_topic_idx
  on public.amaura_pattern_memories(user_id, subject, topic);

alter table public.amaura_pattern_memories enable row level security;

drop policy if exists "amaura_pattern_memories_select_own" on public.amaura_pattern_memories;
create policy "amaura_pattern_memories_select_own"
  on public.amaura_pattern_memories for select
  using (auth.uid() = user_id);

grant select on public.amaura_pattern_memories to authenticated;

create table if not exists public.amaura_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  agent_name text not null,
  event_id uuid null,
  event_type text not null,
  dedup_key text not null,
  status text not null default 'running' check (status in ('running', 'completed', 'skipped', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_name, dedup_key)
);

create index if not exists amaura_agent_runs_user_created_idx
  on public.amaura_agent_runs(user_id, created_at desc);
create index if not exists amaura_agent_runs_agent_status_idx
  on public.amaura_agent_runs(agent_name, status, created_at desc);
create index if not exists amaura_agent_runs_event_idx
  on public.amaura_agent_runs(event_id);

alter table public.amaura_agent_runs enable row level security;

drop policy if exists "amaura_agent_runs_select_own" on public.amaura_agent_runs;
create policy "amaura_agent_runs_select_own"
  on public.amaura_agent_runs for select
  using (auth.uid() = user_id);

grant select on public.amaura_agent_runs to authenticated;

create or replace function public.create_event_with_consumers(
  p_user_id uuid,
  p_type text,
  p_data jsonb,
  p_idempotency_key text,
  p_source text,
  p_metadata jsonb
) returns uuid as $$
declare
  v_event_id uuid;
  v_consumers text[];
begin
  v_consumers := case p_type
    when 'CHAT_MESSAGE_PROCESSED' then array['chat_side_effect_engine', 'mind_agent']
    when 'CHAT_MESSAGE_CREATED' then array['chat_side_effect_engine', 'mind_agent']
    when 'CHAT_LEARNING_SIGNAL' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent']
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'MATERIAL_UPLOADED' then array['rag_agent']
    when 'MATERIAL_INGESTION_REQUESTED' then array['rag_agent']
    when 'MATERIAL_INGESTED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'RAG_QUERY_USED' then array['mind_agent']
    when 'RAG_CARD_CANDIDATE_CREATED' then array['memory_agent']
    when 'MIND_ACTION_REQUESTED' then array['mind_agent']
    when 'MIND_CONTEXT_REFRESHED' then array['mind_agent']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'MOCK_TEST_UPLOADED' then array['autopsy_engine']
    when 'AUTOPSY_PROCESSING_COMPLETED' then array['autopsy_agent', 'planner_agent']
    when 'TEST_ANALYSIS_COMPLETED' then array['autopsy_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_EXTRACTED' then array['autopsy_agent']
    when 'AUTOPSY_MISTAKE_APPROVED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_REJECTED' then array['autopsy_agent']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MOCK_TEST_ANALYZED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'AUTOPSY_V3_ASSESSMENT_CREATED' then array['autopsy_agent']
    when 'AUTOPSY_V3_QUESTIONS_UPSERTED' then array['autopsy_agent']
    when 'AUTOPSY_V3_REASONS_COLLECTED' then array['autopsy_agent', 'learning_state_engine']
    when 'AUTOPSY_V3_REPORT_READY' then array['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'amaura_autopsy_cascade', 'amaura_plan_adapter', 'amaura_progress_evaluator', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'LEARNING_SIGNAL_INGESTED' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent', 'amaura_session_agent', 'downstream_publisher_qstash']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent']
    when 'REVISION_CARD_REVIEWED' then array['memory_agent', 'atlas_agent', 'planner_agent']
    when 'REVISION_COMPLETED' then array['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent']
    when 'MEMORY_CARD_CREATE_REQUESTED' then array['memory_agent']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine', 'command_agent', 'planner_agent']
    when 'ATLAS_MASTERY_UPDATE_REQUESTED' then array['atlas_agent']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine', 'command_agent', 'planner_agent']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'SESSION_CARD_COMPLETED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'SESSION_RECOMMENDATION_REQUESTED' then array['planner_agent']
    when 'SESSION_RECOMMENDATION_CREATED' then array['mind_agent']
    when 'LEARNER_STATE_CHANGED' then array['planner_agent', 'mind_agent']
    when 'PLANNER_REPLAN_REQUESTED' then array['planner_agent', 'command_agent']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'amaura_forgetting_agent', 'amaura_stagnation_agent', 'amaura_pattern_memory', 'downstream_publisher_qstash']
    when 'FORGETTING_SCAN_REQUESTED' then array['amaura_forgetting_agent', 'downstream_publisher_qstash']
    when 'STAGNATION_SCAN_REQUESTED' then array['amaura_stagnation_agent', 'downstream_publisher_qstash']
    when 'PATTERN_MEMORY_SCAN_REQUESTED' then array['amaura_pattern_memory', 'downstream_publisher_qstash']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent', 'amaura_practice_agent', 'downstream_publisher_qstash']
    when 'PRACTICE_ATTEMPT_SUBMITTED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent', 'amaura_practice_agent', 'downstream_publisher_qstash']
    when 'AMAURA_GOAL_CREATED' then array['amaura_goal_decomposer', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_GOAL_UPDATED' then array['amaura_progress_evaluator', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_TASK_CREATED' then array['amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_TASK_COMPLETED' then array['amaura_progress_evaluator', 'amaura_plan_adapter', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_TASK_SKIPPED' then array['amaura_progress_evaluator', 'amaura_plan_adapter', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_OBSERVATION_RECORDED' then array['amaura_progress_evaluator', 'amaura_plan_adapter', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_PLAN_ADAPTED' then array['amaura_next_action', 'downstream_publisher_qstash']
    when 'AMAURA_GOAL_PROGRESS_EVALUATED' then array['amaura_next_action', 'downstream_publisher_qstash']
    when 'MEMORY_REVIEW_COMPLETED' then array['amaura_progress_evaluator', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'ATLAS_CONCEPT_UPDATED' then array['amaura_plan_adapter', 'amaura_progress_evaluator', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'SESSION_CLOSED' then array['amaura_session_agent', 'amaura_progress_evaluator', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'DAILY_AGENT_TICK' then array['amaura_forgetting_agent', 'amaura_stagnation_agent', 'amaura_pattern_memory', 'amaura_progress_evaluator', 'amaura_next_action', 'downstream_publisher_qstash']
    when 'ONBOARDING_QUIZ_COMPLETE' then array['learning_state_engine', 'planner_agent', 'command_agent']
    else array[]::text[]
  end;

  if p_user_id is null or array_length(v_consumers, 1) is null then
    raise exception 'unsupported_event_type';
  end if;

  with inserted as (
    insert into public.event_queue (
      user_id, type, payload, idempotency_key, metadata, status, next_attempt_at
    ) values (
      p_user_id,
      p_type,
      coalesce(p_data, '{}'::jsonb),
      p_idempotency_key,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('source', coalesce(p_source, 'system')),
      'PENDING',
      now()
    )
    on conflict (idempotency_key) do nothing
    returning id
  )
  select id into v_event_id from inserted;

  if v_event_id is null then
    select id into v_event_id
    from public.event_queue
    where idempotency_key = p_idempotency_key;
    return v_event_id;
  end if;

  insert into public.consumer_locks (
    event_id,
    consumer_name,
    status,
    next_retry_at,
    next_attempt_at
  )
  select
    v_event_id,
    unnest(v_consumers),
    'PENDING',
    now(),
    now()
  on conflict (event_id, consumer_name) do nothing;

  return v_event_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
to service_role;

create or replace function public.acquire_event_leases_for_user(
  p_user_id uuid,
  p_worker_id text,
  p_limit int,
  p_lease_timeout interval
) returns table (
  lock_id uuid,
  event_id uuid,
  consumer_name text,
  event_type text,
  event_payload jsonb,
  event_metadata jsonb,
  user_id uuid,
  retry_count int
) as $$
begin
  return query
  with available_locks as (
    select cl.id
    from public.consumer_locks cl
    join public.event_queue eq on eq.id = cl.event_id
    where eq.user_id = p_user_id
      and cl.consumer_name in (
        'amaura_practice_agent',
        'amaura_session_agent',
        'amaura_autopsy_cascade',
        'amaura_forgetting_agent',
        'amaura_stagnation_agent',
        'amaura_pattern_memory',
        'amaura_goal_decomposer',
        'amaura_plan_adapter',
        'amaura_progress_evaluator',
        'amaura_next_action'
      )
      and (
        (cl.status in ('PENDING', 'RETRY_SCHEDULED') and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now())
        or
        (cl.status = 'PROCESSING' and cl.lease_expires_at is not null and cl.lease_expires_at < now())
      )
      and cl.retry_count < 3
    order by cl.created_at asc
    limit greatest(1, least(p_limit, 3))
    for update skip locked
  ),
  updated_locks as (
    update public.consumer_locks cl
    set
      status = 'PROCESSING',
      worker_id = p_worker_id,
      locked_by = p_worker_id,
      locked_at = now(),
      lease_expires_at = now() + p_lease_timeout,
      updated_at = now()
    from available_locks al
    where cl.id = al.id
    returning cl.id, cl.event_id, cl.consumer_name, cl.retry_count
  ),
  touched_events as (
    update public.event_queue eq
    set
      status = 'PROCESSING',
      locked_by = p_worker_id,
      locked_at = now(),
      updated_at = now()
    from updated_locks ul
    where eq.id = ul.event_id
    returning eq.id
  )
  select
    ul.id,
    ul.event_id,
    ul.consumer_name,
    eq.type,
    eq.payload,
    eq.metadata,
    eq.user_id,
    ul.retry_count
  from updated_locks ul
  join public.event_queue eq on eq.id = ul.event_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.acquire_event_leases_for_user(uuid, text, int, interval)
from public, anon, authenticated;
grant execute on function public.acquire_event_leases_for_user(uuid, text, int, interval)
to service_role;
