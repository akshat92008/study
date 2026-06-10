-- Final executable MVP hardening pass.
-- Idempotent: safe to run after the existing active migration chain.

create extension if not exists pgcrypto;
create extension if not exists vector;
do $$
begin
  create type public.event_status as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter type public.event_status add value if not exists 'PARTIAL_FAILED';
  alter type public.event_status add value if not exists 'DLQ';
exception
  when undefined_object then null;
end $$;
do $$
begin
  create type public.consumer_lock_status as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY_SCHEDULED', 'DLQ');
exception
  when duplicate_object then null;
end $$;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  exam_type text,
  target_date date,
  target_score numeric,
  current_level text,
  onboarding_complete boolean not null default false,
  timezone text,
  streak_days integer not null default 0,
  last_active_at timestamptz,
  learner_state_version integer not null default 0,
  emotional_state text default 'neutral',
  overall_mastery numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles
  add column if not exists target_date date,
  add column if not exists target_score numeric,
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists timezone text,
  add column if not exists learner_state_version integer not null default 0,
  add column if not exists emotional_state text default 'neutral',
  add column if not exists overall_mastery numeric default 0,
  add column if not exists updated_at timestamptz not null default now();
create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  deadline text,
  current_level text,
  time_available text,
  preferred_learning_style text,
  confidence_score numeric,
  roadmap jsonb not null default '{}'::jsonb,
  progress numeric not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.learning_goals
  add column if not exists deadline text,
  add column if not exists current_level text,
  add column if not exists time_available text,
  add column if not exists preferred_learning_style text,
  add column if not exists confidence_score numeric,
  add column if not exists roadmap jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();
create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  chapter text not null,
  topic text not null,
  name text not null,
  mastery text not null default 'not_started',
  mastery_score numeric not null default 0,
  forgetting_probability numeric not null default 1,
  times_reviewed integer not null default 0,
  confidence text not null default 'low',
  last_reviewed_at timestamptz,
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.concepts
  add column if not exists topic text,
  add column if not exists name text,
  add column if not exists mastery_score numeric not null default 0,
  add column if not exists forgetting_probability numeric not null default 1,
  add column if not exists times_reviewed integer not null default 0,
  add column if not exists confidence text not null default 'low',
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists embedding vector(768);
create table if not exists public.concept_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  alias text not null,
  normalized_alias text,
  created_at timestamptz not null default now()
);
alter table public.concept_aliases
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists normalized_alias text;
update public.concept_aliases ca
set user_id = c.user_id
from public.concepts c
where ca.concept_id = c.id
  and ca.user_id is null;
create table if not exists public.concept_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_concept_id uuid not null references public.concepts(id) on delete cascade,
  target_concept_id uuid not null references public.concepts(id) on delete cascade,
  link_type text not null,
  strength numeric not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists public.mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  old_mastery text,
  new_mastery text,
  evidence text,
  evidence_type text,
  source text,
  source_id text,
  source_event_id uuid,
  weight numeric,
  confidence numeric,
  created_at timestamptz not null default now()
);
alter table public.mastery_events
  add column if not exists old_mastery text,
  add column if not exists new_mastery text,
  add column if not exists evidence text,
  add column if not exists source_event_id uuid,
  add column if not exists weight numeric;
create table if not exists public.concept_mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  evidence_type text,
  evidence jsonb not null default '{}'::jsonb,
  source text,
  source_id text,
  confidence numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.revision_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  subject text,
  chapter text,
  front text not null,
  back text not null,
  due timestamptz not null default now(),
  state integer not null default 0,
  stability numeric not null default 0,
  difficulty numeric not null default 5,
  reps integer not null default 0,
  lapses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.revision_cards
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists due timestamptz not null default now(),
  add column if not exists state integer not null default 0,
  add column if not exists stability numeric not null default 0,
  add column if not exists difficulty numeric not null default 5,
  add column if not exists reps integer not null default 0,
  add column if not exists lapses integer not null default 0;
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  summary text,
  session_type text not null default 'global',
  is_global boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chat_sessions
  add column if not exists session_type text not null default 'global',
  add column if not exists is_global boolean not null default false;
create unique index if not exists idx_chat_sessions_one_global
  on public.chat_sessions(user_id)
  where session_type = 'global';
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  intent text,
  emotional_state text,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);
alter table public.chat_messages
  add column if not exists intent text,
  add column if not exists emotional_state text,
  add column if not exists idempotency_key text;
create unique index if not exists idx_chat_messages_user_idempotency
  on public.chat_messages(user_id, idempotency_key)
  where idempotency_key is not null;
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  chapter text,
  topic text,
  concept_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed_at timestamptz,
  duration_minutes integer not null default 0,
  understood boolean not null default true,
  gap_found text,
  cards_created integer not null default 0,
  session_type text not null default 'study',
  is_completed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.study_sessions
  add column if not exists topic text,
  add column if not exists concept_name text,
  add column if not exists completed_at timestamptz,
  add column if not exists understood boolean not null default true,
  add column if not exists gap_found text,
  add column if not exists cards_created integer not null default 0,
  add column if not exists session_type text not null default 'study',
  add column if not exists is_completed boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
create table if not exists public.session_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  learner_state_version integer not null default 0,
  "dayNumber" integer,
  "streakDays" integer,
  "focusTopic" text,
  subject text,
  "estimatedMinutes" integer,
  rationale text,
  "daysToExam" integer,
  "overdueCards" integer,
  "masteryPercent" integer,
  "closingMessage" text,
  "taskType" text,
  "resourceType" text,
  "targetConceptId" uuid references public.concepts(id) on delete set null,
  priority text,
  "isCompleted" boolean not null default false,
  "completedAt" timestamptz,
  "selectionReason" text,
  "mistakeCount" integer not null default 0,
  "weakConceptCount" integer not null default 0,
  "hasActiveGoal" boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);
alter table public.session_cards
  add column if not exists learner_state_version integer not null default 0,
  add column if not exists "taskType" text,
  add column if not exists "resourceType" text,
  add column if not exists "targetConceptId" uuid references public.concepts(id) on delete set null,
  add column if not exists priority text,
  add column if not exists "isCompleted" boolean not null default false,
  add column if not exists "completedAt" timestamptz,
  add column if not exists "selectionReason" text,
  add column if not exists "mistakeCount" integer not null default 0,
  add column if not exists "weakConceptCount" integer not null default 0,
  add column if not exists "hasActiveGoal" boolean not null default false;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_cards_user_id_date_key'
      and conrelid = 'public.session_cards'::regclass
  ) then
    alter table public.session_cards add constraint session_cards_user_id_date_key unique(user_id, date);
  end if;
end $$;
create table if not exists public.learner_state_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.event_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text unique,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status public.event_status not null default 'PENDING',
  retry_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.event_queue
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text;
create table if not exists public.consumer_locks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_queue(id) on delete cascade,
  consumer_name text not null,
  status public.consumer_lock_status not null default 'PENDING',
  worker_id text,
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  retry_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, consumer_name)
);
alter table public.consumer_locks
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_error text;
create table if not exists public.event_attempts (
  id uuid primary key default gen_random_uuid(),
  consumer_lock_id uuid references public.consumer_locks(id) on delete cascade,
  event_id uuid references public.event_queue(id) on delete cascade,
  consumer_name text,
  worker_id text,
  result_status text,
  result_reason text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.event_attempts
  add column if not exists event_id uuid references public.event_queue(id) on delete cascade,
  add column if not exists consumer_name text,
  add column if not exists result_status text,
  add column if not exists result_reason text;
create table if not exists public.event_dlq (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.event_queue(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  consumer_name text,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  event_metadata jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.event_dlq
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists event_type text,
  add column if not exists event_metadata jsonb not null default '{}'::jsonb,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists resolved_at timestamptz;
create table if not exists public.mock_autopsies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_name text,
  exam_type text,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unattempted_count integer not null default 0,
  current_score numeric not null default 0,
  recoverable_marks numeric not null default 0,
  potential_score numeric not null default 0,
  status text not null default 'pending',
  idempotency_key text,
  trace_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.mock_autopsies
  add column if not exists test_name text,
  add column if not exists exam_type text,
  add column if not exists total_questions integer not null default 0,
  add column if not exists correct_count integer not null default 0,
  add column if not exists incorrect_count integer not null default 0,
  add column if not exists unattempted_count integer not null default 0,
  add column if not exists current_score numeric not null default 0,
  add column if not exists recoverable_marks numeric not null default 0,
  add column if not exists potential_score numeric not null default 0,
  add column if not exists idempotency_key text,
  add column if not exists trace_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists error_message text;
create table if not exists public.autopsy_questions (
  id uuid primary key default gen_random_uuid(),
  autopsy_id uuid not null references public.mock_autopsies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_number integer,
  subject text,
  chapter text,
  subtopic text,
  difficulty text,
  status text not null default 'Unattempted',
  question_text text,
  correct_answer text,
  student_answer text,
  mistake_category text,
  reasoning text,
  marks_lost numeric not null default 0,
  needs_review boolean not null default false,
  ocr_confidence numeric,
  extraction_confidence numeric,
  evidence_status text not null default 'ignored_or_unverified',
  source_hash text,
  trace_id uuid,
  trace_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.autopsy_questions
  add column if not exists question_number integer,
  add column if not exists subtopic text,
  add column if not exists difficulty text,
  add column if not exists correct_answer text,
  add column if not exists student_answer text,
  add column if not exists mistake_category text,
  add column if not exists reasoning text,
  add column if not exists marks_lost numeric not null default 0,
  add column if not exists needs_review boolean not null default false,
  add column if not exists ocr_confidence numeric,
  add column if not exists extraction_confidence numeric,
  add column if not exists evidence_status text not null default 'ignored_or_unverified',
  add column if not exists source_hash text,
  add column if not exists trace_id uuid,
  add column if not exists trace_metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  feature text,
  route text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  model text,
  estimated_cost numeric not null default 0,
  status text not null default 'reserved',
  route text,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.worker_health (
  worker_id text primary key,
  last_heartbeat timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb
);
-- RLS: user-owned MVP data is owner-scoped; operational queues are service-only.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'learning_goals', 'concepts', 'concept_aliases', 'concept_links',
    'mastery_events', 'concept_mastery_events', 'revision_cards', 'chat_sessions',
    'chat_messages', 'study_sessions', 'session_cards', 'learner_state_versions',
    'mock_autopsies', 'autopsy_questions', 'ai_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
drop policy if exists "users_all_own_profiles" on public.profiles;
create policy "users_all_own_profiles"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
do $$
declare
  t text;
begin
  foreach t in array array[
    'learning_goals', 'concepts', 'concept_aliases', 'concept_links',
    'mastery_events', 'concept_mastery_events', 'revision_cards', 'chat_sessions',
    'chat_messages', 'study_sessions', 'session_cards', 'learner_state_versions',
    'mock_autopsies', 'autopsy_questions', 'ai_usage_events'
  ] loop
    execute format('drop policy if exists "users_all_own_%s" on public.%I', t, t);
    execute format(
      'create policy "users_all_own_%s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t,
      t
    );
  end loop;
end $$;
alter table public.event_queue enable row level security;
alter table public.consumer_locks enable row level security;
alter table public.event_attempts enable row level security;
alter table public.event_dlq enable row level security;
alter table public.ai_budget_reservations enable row level security;
alter table public.worker_health enable row level security;
drop policy if exists "users_all_own_event_queue" on public.event_queue;
drop policy if exists "Users access own event_queue" on public.event_queue;
drop policy if exists "users_all_own_event_dlq" on public.event_dlq;
drop policy if exists "Users access own event_dlq" on public.event_dlq;
drop policy if exists "Users view own ai_budget_reservations" on public.ai_budget_reservations;
drop policy if exists "users_all_own_ai_budget_reservations" on public.ai_budget_reservations;
do $$
declare
  t text;
begin
  foreach t in array array[
    'event_queue', 'consumer_locks', 'event_attempts', 'event_dlq',
    'ai_budget_reservations', 'worker_health'
  ] loop
    execute format('drop policy if exists "service_role_all_%s" on public.%I', t, t);
    execute format(
      'create policy "service_role_all_%s" on public.%I for all using (current_setting(''request.jwt.claim.role'', true) = ''service_role'') with check (current_setting(''request.jwt.claim.role'', true) = ''service_role'')',
      t,
      t
    );
  end loop;
end $$;
-- Correct per-event consumer routing. User request paths enqueue only; workers consume locks.
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
    when 'CHAT_MESSAGE_PROCESSED' then array['chat_side_effect_engine']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'COMMAND_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'COMMAND_TASK_COMPLETED' then array['learning_state_engine']
    when 'COMMAND_TASK_DELAYED' then array['learning_state_engine']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'COMMAND_SESSION_CREATED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
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
create or replace function public.acquire_event_leases(
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
    where (
        (cl.status in ('PENDING', 'RETRY_SCHEDULED') and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now())
        or
        (cl.status = 'PROCESSING' and cl.lease_expires_at is not null and cl.lease_expires_at < now())
      )
      and cl.retry_count < 3
    order by cl.created_at asc
    limit p_limit
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
drop function if exists public.match_concepts cascade;
create or replace function public.match_concepts(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
) returns table (
  id uuid,
  name text,
  subject text,
  chapter text,
  topic text,
  similarity float
) as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  return query
  select
    c.id,
    c.name,
    c.subject,
    c.chapter,
    c.topic,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.concepts c
  where c.user_id = p_user_id
    and c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
end;
$$ language plpgsql stable security definer set search_path = public;
revoke execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
  from public, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
  to service_role;
revoke execute on function public.acquire_event_leases(text, int, interval)
  from public, authenticated;
grant execute on function public.acquire_event_leases(text, int, interval)
  to service_role;
revoke execute on function public.match_concepts(vector(768), float, int, uuid)
  from public;
grant execute on function public.match_concepts(vector(768), float, int, uuid)
  to authenticated;
create index if not exists idx_profiles_updated
  on public.profiles(id, updated_at desc);
create index if not exists idx_learning_goals_user_created
  on public.learning_goals(user_id, created_at desc);
create index if not exists idx_concepts_user_created
  on public.concepts(user_id, created_at desc);
create index if not exists idx_concept_aliases_user_alias
  on public.concept_aliases(user_id, normalized_alias);
create index if not exists idx_concept_links_user_created
  on public.concept_links(user_id, created_at desc);
create index if not exists idx_mastery_events_user_created
  on public.mastery_events(user_id, created_at desc);
create index if not exists idx_concept_mastery_events_user_created
  on public.concept_mastery_events(user_id, created_at desc);
create index if not exists idx_revision_cards_user_due
  on public.revision_cards(user_id, due);
create index if not exists idx_revision_cards_user_created
  on public.revision_cards(user_id, created_at desc);
create index if not exists idx_chat_sessions_user_created
  on public.chat_sessions(user_id, created_at desc);
create index if not exists idx_chat_messages_session_created
  on public.chat_messages(session_id, created_at);
create index if not exists idx_chat_messages_user_created
  on public.chat_messages(user_id, created_at desc);
create index if not exists idx_study_sessions_user_created
  on public.study_sessions(user_id, created_at desc);
create index if not exists idx_session_cards_user_created
  on public.session_cards(user_id, created_at desc);
create index if not exists idx_learner_state_versions_updated
  on public.learner_state_versions(user_id, updated_at desc);
create index if not exists idx_event_queue_status_next_created
  on public.event_queue(status, next_attempt_at, created_at);
create index if not exists idx_consumer_locks_event
  on public.consumer_locks(event_id);
create index if not exists idx_consumer_locks_status_next
  on public.consumer_locks(status, next_attempt_at, next_retry_at, lease_expires_at);
create index if not exists idx_event_dlq_unresolved
  on public.event_dlq(created_at)
  where resolved_at is null;
create index if not exists idx_mock_autopsies_user_created
  on public.mock_autopsies(user_id, created_at desc);
create unique index if not exists idx_mock_autopsies_idempotency
  on public.mock_autopsies(user_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_autopsy_questions_user_created
  on public.autopsy_questions(user_id, created_at desc);
create index if not exists idx_autopsy_questions_autopsy
  on public.autopsy_questions(autopsy_id, question_number);
create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events(user_id, created_at desc);
create index if not exists idx_ai_budget_reservations_user_date_status
  on public.ai_budget_reservations(user_id, usage_date, status);
