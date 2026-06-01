-- Private beta MVP schema and event-routing canonicalization.
-- Idempotent forward migration: preserves existing data, aligns runtime field names,
-- and makes SQL event consumers match lib/events/routes.ts.

create extension if not exists pgcrypto;

-- Profiles: canonical runtime columns.
alter table if exists public.profiles
  add column if not exists exam_type text,
  add column if not exists streak_days integer not null default 0,
  add column if not exists last_active_at timestamptz,
  add column if not exists learner_state_version integer not null default 0,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'free';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'exam'
  ) then
    execute 'update public.profiles set exam_type = coalesce(exam_type, exam)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'current_streak'
  ) then
    execute 'update public.profiles set streak_days = coalesce(streak_days, current_streak, 0)';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_active_date'
  ) then
    execute 'update public.profiles set last_active_at = coalesce(last_active_at, last_active_date::timestamptz)';
  end if;
end $$;

-- Goals: canonical learning_goals table, with one-way backfill from legacy study_goals.
create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_date date,
  progress numeric default 0,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'study_goals'
  ) then
    execute $backfill$
      insert into public.learning_goals (id, user_id, title, target_date, progress, status, metadata, created_at, updated_at)
      select
        coalesce(id, gen_random_uuid()),
        user_id,
        coalesce(title, 'Study goal'),
        target_date,
        coalesce(progress, 0),
        coalesce(status, 'active'),
        coalesce(metadata, '{}'::jsonb),
        coalesce(created_at, now()),
        coalesce(updated_at, now())
      from public.study_goals
      where user_id is not null
      on conflict (id) do nothing
    $backfill$;
  end if;
end $$;

-- Concepts: canonical ATLAS mastery fields.
create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  subject text,
  chapter text,
  topic text,
  mastery text not null default 'not_started',
  mastery_score numeric not null default 0,
  confidence text not null default 'low',
  importance text not null default 'core',
  forgetting_probability numeric not null default 1,
  forgetting numeric,
  last_reviewed_at timestamptz,
  times_reviewed integer not null default 0,
  times_correct numeric not null default 0,
  times_incorrect numeric not null default 0,
  retention_strength numeric not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.concepts
  add column if not exists description text,
  add column if not exists mastery text not null default 'not_started',
  add column if not exists mastery_score numeric not null default 0,
  add column if not exists confidence text not null default 'low',
  add column if not exists importance text not null default 'core',
  add column if not exists forgetting_probability numeric not null default 1,
  add column if not exists forgetting numeric,
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists times_reviewed integer not null default 0,
  add column if not exists times_correct numeric not null default 0,
  add column if not exists times_incorrect numeric not null default 0,
  add column if not exists retention_strength numeric not null default 0,
  add column if not exists version integer not null default 1;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery_level'
  ) then
    execute $backfill$
      update public.concepts
      set mastery = coalesce(
        mastery,
        case
          when mastery_level >= 0.85 then 'mastered'
          when mastery_level >= 0.60 then 'developing'
          when mastery_level > 0 then 'exposed'
          else 'not_started'
        end
      ),
      mastery_score = greatest(coalesce(mastery_score, 0), coalesce(mastery_level, 0) * 100)
    $backfill$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'forgetting_probability'
  ) then
    execute 'update public.concepts set forgetting = coalesce(forgetting, forgetting_probability)';
  end if;
end $$;

-- MEMORY: canonical FSRS-compatible revision_cards shape.
create table if not exists public.revision_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  front text not null,
  back text,
  due timestamptz not null default now(),
  state integer not null default 0,
  stability numeric not null default 0,
  difficulty numeric not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  last_review timestamptz,
  scheduled_days integer not null default 0,
  elapsed_days integer not null default 0,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.revision_cards
  add column if not exists due timestamptz,
  add column if not exists stability numeric not null default 0,
  add column if not exists difficulty numeric not null default 0,
  add column if not exists reps integer not null default 0,
  add column if not exists lapses integer not null default 0,
  add column if not exists last_review timestamptz,
  add column if not exists scheduled_days integer not null default 0,
  add column if not exists elapsed_days integer not null default 0,
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
declare
  v_state_type text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'due_at'
  ) then
    execute 'update public.revision_cards set due = coalesce(due, due_at)';
  end if;

  select data_type into v_state_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'state';

  if v_state_type is null then
    execute 'alter table public.revision_cards add column state integer not null default 0';
  elsif v_state_type <> 'integer' then
    execute 'alter table public.revision_cards add column if not exists state_int integer';
    execute $map$
      update public.revision_cards
      set state_int = case lower(coalesce(state::text, 'new'))
        when 'new' then 0
        when 'learning' then 1
        when 'review' then 2
        when 'relearning' then 3
        when 'suspended' then 4
        else 0
      end
      where state_int is null
    $map$;
    execute 'alter table public.revision_cards rename column state to legacy_state_text';
    execute 'alter table public.revision_cards rename column state_int to state';
    execute 'alter table public.revision_cards alter column state set default 0';
    execute 'alter table public.revision_cards alter column state set not null';
  end if;

  execute 'update public.revision_cards set due = coalesce(due, now()) where due is null';
  execute 'alter table public.revision_cards alter column due set not null';
end $$;

-- Runtime MVP tables. These definitions are intentionally minimal-but-canonical:
-- existing richer tables keep their data and columns.
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_type text not null default 'global',
  is_global boolean not null default false,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  intent text,
  emotional_state text,
  prompt_version text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_autopsies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_name text,
  exam_type text,
  current_score numeric default 0,
  potential_score numeric default 0,
  recoverable_marks numeric default 0,
  idempotency_key text,
  event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.autopsy_questions (
  id uuid primary key default gen_random_uuid(),
  autopsy_id uuid not null references public.mock_autopsies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_number integer,
  subject text,
  chapter text,
  status text,
  evidence_status text,
  extraction_confidence numeric,
  needs_review boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.autopsy_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  test_name text,
  exam_type text,
  payload jsonb not null default '{}'::jsonb,
  result_autopsy_id uuid,
  error_message text,
  retry_count integer not null default 0,
  idempotency_key text,
  source text,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.autopsy_jobs
  add column if not exists status text not null default 'pending',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists retry_count integer not null default 0,
  add column if not exists idempotency_key text,
  add column if not exists source text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz;

update public.autopsy_jobs
set status = 'pending'
where status = 'queued';

do $$
begin
  alter table public.autopsy_jobs
    drop constraint if exists autopsy_jobs_status_check;
  alter table public.autopsy_jobs
    add constraint autopsy_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'needs_user_input', 'failed'));
exception
  when undefined_table then null;
end $$;

create table if not exists public.session_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  learner_state_version integer not null default 0,
  "focusTopic" text,
  subject text,
  "estimatedMinutes" integer,
  rationale text,
  priority text,
  "taskType" text,
  "resourceType" text,
  "targetConceptId" uuid references public.concepts(id) on delete set null,
  "isCompleted" boolean not null default false,
  "completedAt" timestamptz,
  source_signals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING',
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consumer_locks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_queue(id) on delete cascade,
  consumer_name text not null,
  status text not null default 'PENDING',
  retry_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, consumer_name)
);

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

create table if not exists public.event_dlq (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.event_queue(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
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

create table if not exists public.ai_usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  total_usd numeric not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, usage_date)
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null,
  model text,
  cost_usd numeric not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reservation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Constraints and indexes needed by runtime idempotency/cache contracts.
create unique index if not exists idx_chat_sessions_one_global
  on public.chat_sessions(user_id)
  where is_global = true;

create unique index if not exists idx_chat_messages_user_idempotency
  on public.chat_messages(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_mock_autopsies_idempotency
  on public.mock_autopsies(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_autopsy_jobs_idempotency
  on public.autopsy_jobs(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_session_cards_user_date
  on public.session_cards(user_id, date);

create unique index if not exists idx_revision_cards_source_unique
  on public.revision_cards(user_id, source_type, source_id)
  where source_type is not null and source_id is not null;

create index if not exists idx_profiles_updated
  on public.profiles(id, updated_at desc);
create index if not exists idx_learning_goals_user_created
  on public.learning_goals(user_id, created_at desc);
create index if not exists idx_concepts_user_created
  on public.concepts(user_id, created_at desc);
create index if not exists idx_concepts_user_mastery
  on public.concepts(user_id, mastery, forgetting_probability desc);
create index if not exists idx_revision_cards_user_due
  on public.revision_cards(user_id, due);
create index if not exists idx_chat_messages_session_created
  on public.chat_messages(session_id, created_at);
create index if not exists idx_autopsy_questions_autopsy
  on public.autopsy_questions(autopsy_id, question_number);
create index if not exists idx_event_queue_status_next
  on public.event_queue(status, next_attempt_at, created_at);
create index if not exists idx_consumer_locks_status_next
  on public.consumer_locks(status, next_attempt_at, next_retry_at, lease_expires_at);
create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events(user_id, created_at desc);

-- RLS policies for MVP user-owned tables. Service role is permitted explicitly for workers.
do $$
declare
  t text;
begin
  foreach t in array array[
    'learning_goals', 'concepts', 'revision_cards', 'chat_sessions', 'chat_messages',
    'mock_autopsies', 'autopsy_questions', 'autopsy_jobs', 'session_cards',
    'learner_states', 'ai_usage_daily', 'ai_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "users_all_own_%s" on public.%I', t, t);
    execute format(
      'create policy "users_all_own_%s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t,
      t
    );
    execute format('drop policy if exists "service_role_all_%s" on public.%I', t, t);
    execute format(
      'create policy "service_role_all_%s" on public.%I for all using (current_setting(''request.jwt.claim.role'', true) = ''service_role'') with check (current_setting(''request.jwt.claim.role'', true) = ''service_role'')',
      t,
      t
    );
  end loop;

  alter table public.profiles enable row level security;
  drop policy if exists "users_all_own_profiles" on public.profiles;
  create policy "users_all_own_profiles" on public.profiles
    for all using (auth.uid() = id) with check (auth.uid() = id);
end $$;

-- Canonical event consumer matrix. Keep in exact sync with lib/events/routes.ts.
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
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'command_engine', 'learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'command_engine']
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
  from public, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
  to service_role;
