-- Cheap agentic OS core: deterministic learner evidence, policy-gated
-- agent actions, practice idempotency, and final event route aliases.

create table if not exists public.learning_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id text,
  subject text,
  chapter text,
  topic text,
  evidence_type text not null,
  score numeric,
  confidence numeric default 0.7,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.learning_evidence enable row level security;
drop policy if exists "Users can read own learning evidence" on public.learning_evidence;
create policy "Users can read own learning evidence"
  on public.learning_evidence for select
  using (auth.uid() = user_id);
drop policy if exists "Users can insert own learning evidence" on public.learning_evidence;
create policy "Users can insert own learning evidence"
  on public.learning_evidence for insert
  with check (auth.uid() = user_id);
create index if not exists learning_evidence_user_created_idx
  on public.learning_evidence(user_id, created_at desc);
create index if not exists learning_evidence_user_topic_idx
  on public.learning_evidence(user_id, subject, chapter, topic);

create table if not exists public.student_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  chapter text,
  topic text,
  mastery_score numeric not null default 0.5,
  confidence numeric not null default 0.5,
  attempts_count integer not null default 0,
  correct_count integer not null default 0,
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, subject, chapter, topic)
);

alter table public.student_mastery enable row level security;
drop policy if exists "Users can read own mastery" on public.student_mastery;
create policy "Users can read own mastery"
  on public.student_mastery for select
  using (auth.uid() = user_id);
create index if not exists student_mastery_user_updated_idx
  on public.student_mastery(user_id, updated_at desc);

create table if not exists public.mistake_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  chapter text,
  topic text,
  pattern_type text not null,
  severity numeric not null default 0.5,
  occurrences integer not null default 1,
  last_seen_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique(user_id, subject, chapter, topic, pattern_type)
);

alter table public.mistake_patterns enable row level security;
drop policy if exists "Users can read own mistake patterns" on public.mistake_patterns;
create policy "Users can read own mistake patterns"
  on public.mistake_patterns for select
  using (auth.uid() = user_id);
create index if not exists mistake_patterns_user_seen_idx
  on public.mistake_patterns(user_id, last_seen_at desc);

alter table if exists public.practice_attempts
  add column if not exists idempotency_key text;
create unique index if not exists practice_attempts_user_id_idempotency_key_idx
  on public.practice_attempts(user_id, idempotency_key)
  where idempotency_key is not null;

alter table if exists public.agent_actions
  add column if not exists event_id uuid;
create index if not exists idx_agent_actions_event_id
  on public.agent_actions(event_id);
create index if not exists agent_actions_user_status_idx
  on public.agent_actions(user_id, status, created_at desc);

alter table if exists public.agent_runs
  drop constraint if exists agent_runs_agent_name_check;
alter table if exists public.agent_runs
  add constraint agent_runs_agent_name_check
  check (agent_name in ('mind', 'rag', 'atlas', 'memory', 'autopsy', 'revision', 'planner', 'command', 'pulse', 'system'));

alter table if exists public.agent_actions
  drop constraint if exists agent_actions_agent_name_check;
alter table if exists public.agent_actions
  add constraint agent_actions_agent_name_check
  check (agent_name in ('mind', 'rag', 'atlas', 'memory', 'autopsy', 'revision', 'planner', 'command', 'pulse', 'system'));

create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null default current_date,
  status text not null default 'draft',
  source text not null default 'rule_agent',
  payload jsonb not null default '{}'::jsonb,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, mission_date)
);

alter table public.daily_missions enable row level security;
drop policy if exists "Users can read own daily missions" on public.daily_missions;
create policy "Users can read own daily missions"
  on public.daily_missions for select
  using (auth.uid() = user_id);
create index if not exists daily_missions_user_date_idx
  on public.daily_missions(user_id, mission_date desc);

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
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
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
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'command_engine']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'PRACTICE_ATTEMPT_SUBMITTED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
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
