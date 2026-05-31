-- ============================================================================
-- COGNITION OS — MVP Production Schema Hardening
-- ============================================================================

-- 1. Ensure all MVP tables exist
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  exam_type text,
  current_level text,
  streak_days int default 0,
  last_active_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.learning_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  roadmap jsonb,
  progress float default 0,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.concepts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  chapter text not null,
  topic text not null,
  name text not null,
  mastery text default 'not_started',
  forgetting float default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.concept_aliases (
  id uuid primary key default uuid_generate_v4(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  alias text not null,
  created_at timestamptz default now()
);

create table if not exists public.concept_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_concept_id uuid not null references public.concepts(id) on delete cascade,
  target_concept_id uuid not null references public.concepts(id) on delete cascade,
  link_type text not null,
  strength float default 1.0,
  created_at timestamptz default now()
);

create table if not exists public.mastery_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  evidence_type text not null,
  source text not null,
  source_id text,
  confidence float,
  created_at timestamptz default now()
);

create table if not exists public.revision_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  front text not null,
  back text not null,
  due timestamptz default now(),
  state text default 'new',
  stability float default 0,
  difficulty float default 5,
  reps int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  duration_minutes int default 0,
  understood boolean default true,
  cards_created int default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.session_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text default 'pending',
  learner_state_version int not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.learner_states (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_type text not null,
  state_value jsonb,
  created_at timestamptz default now()
);

create table if not exists public.event_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text default 'pending',
  next_attempt_at timestamptz default now(),
  retry_count int default 0,
  created_at timestamptz default now()
);

create table if not exists public.consumer_locks (
  id text primary key,
  consumer_id text not null,
  locked_at timestamptz default now(),
  expires_at timestamptz not null
);

create table if not exists public.event_dlq (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null,
  error_message text not null,
  created_at timestamptz default now()
);

create table if not exists public.mock_autopsies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text default 'pending',
  raw_text text,
  diagnosis jsonb,
  created_at timestamptz default now()
);

create table if not exists public.autopsy_questions (
  id uuid primary key default uuid_generate_v4(),
  autopsy_id uuid not null references public.mock_autopsies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_text text,
  category text,
  created_at timestamptz default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  feature text,
  estimated_cost numeric,
  created_at timestamptz default now()
);

create table if not exists public.ai_budget_reservations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  feature text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.provider_health (
  provider text primary key,
  status text default 'healthy',
  last_check_at timestamptz default now()
);

create table if not exists public.worker_health (
  worker_id text primary key,
  last_heartbeat timestamptz default now()
);

-- 2. Foreign Key Hardening: Ensure references auth.users(id) on delete cascade
-- Already handled by `references auth.users(id) on delete cascade` above,
-- but we must alter existing tables if they reference profiles instead of auth.users
-- Since this is idempotent, we'll ensure RLS is enabled.

-- 3. Enable Row Level Security (RLS)
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'learning_goals', 'concepts', 'concept_aliases', 'concept_links',
    'mastery_events', 'revision_cards', 'chat_sessions', 'chat_messages',
    'study_sessions', 'session_cards', 'learner_states', 'event_queue',
    'event_dlq', 'mock_autopsies', 'autopsy_questions', 'ai_usage_events',
    'ai_budget_reservations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 4. Establish Default Policies (Users access own rows)
do $$
declare
  t text;
begin
  foreach t in array array[
    'learning_goals', 'concepts', 'concept_links', 'mastery_events',
    'revision_cards', 'chat_sessions', 'chat_messages', 'study_sessions',
    'session_cards', 'learner_states', 'event_queue', 'event_dlq',
    'mock_autopsies', 'autopsy_questions', 'ai_usage_events', 'ai_budget_reservations'
  ] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'users_all_own_' || t) then
      execute format('drop policy if exists "users_all_own_%I" on public.%I', t, t);
      execute format('create policy "users_all_own_%I" on public.%I for all using (auth.uid() = user_id)', t, t);
    end if;
  end loop;

  -- Profile policy is keyed by id instead of user_id
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'users_all_own_profiles') then
    drop policy if exists "users_all_own_profiles" on public.profiles;
    create policy "users_all_own_profiles" on public.profiles for all using (auth.uid() = id);
  end if;

  -- Concept Aliases uses concept_id -> concepts.user_id
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'concept_aliases' and policyname = 'users_all_own_concept_aliases') then
    drop policy if exists "users_all_own_concept_aliases" on public.concept_aliases;
    create policy "users_all_own_concept_aliases" on public.concept_aliases for all using (
      concept_id in (select id from public.concepts where user_id = auth.uid())
    );
  end if;
end $$;

-- 5. Add critical indexes
do $$
declare
  v_state_type text;
begin
  select data_type into v_state_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'revision_cards'
    and column_name = 'state';

  if v_state_type = 'integer' then
    execute 'create index if not exists idx_revision_cards_due on public.revision_cards(user_id, due) where state <> 4';
  else
    execute 'create index if not exists idx_revision_cards_due on public.revision_cards(user_id, due) where state <> ''suspended''';
  end if;
end $$;
create index if not exists idx_event_queue_status on public.event_queue(status, next_attempt_at);
create index if not exists idx_chat_messages_lookup on public.chat_messages(session_id, created_at desc);

-- 6. Harden RPCs (search_path)
do $$
declare
  r record;
begin
  for r in 
    select
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p 
    join pg_namespace n on p.pronamespace = n.oid 
    where n.nspname = 'public' and p.prosecdef = true
  loop
    execute format('alter function public.%I(%s) set search_path = public', r.proname, r.identity_args);
  end loop;
end $$;
