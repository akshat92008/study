-- ============================================================================
-- COGNITION OS — INITIAL SCHEMA (reverse-engineered from production)
-- ============================================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "pg_trgm";
-- ============================================================================
-- USER PROFILES
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  exam text check (exam in ('neet', 'jee', 'jee-advanced', 'other')),
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  learning_style text,
  target_date date,
  daily_hours int default 4,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date,
  emotional_state text default 'neutral',
  emotional_state_updated_at timestamptz default now(),
  onboarding_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- ============================================================================
-- KNOWLEDGE GRAPH (ATLAS)
-- ============================================================================
create table if not exists concepts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  chapter text not null,
  topic text not null,
  name text not null,
  description text,
  mastery_level float default 0 check (mastery_level >= 0 and mastery_level <= 1),
  mastery_tier text default 'unknown' check (mastery_tier in ('unknown','weak','developing','proficient','mastered')),
  retention_strength float default 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  exposure_count int default 0,
  correct_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, subject, chapter, topic, name)
);
create index idx_concepts_user on concepts(user_id);
create index idx_concepts_chapter on concepts(user_id, chapter);
create index idx_concepts_mastery on concepts(user_id, mastery_tier);
create table if not exists concept_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  from_concept_id uuid not null references concepts(id) on delete cascade,
  to_concept_id uuid not null references concepts(id) on delete cascade,
  link_type text not null check (link_type in ('prerequisite','related','contradicts')),
  strength float default 1.0,
  created_at timestamptz default now(),
  unique(from_concept_id, to_concept_id, link_type)
);
create index idx_concept_links_from on concept_links(from_concept_id);
create index idx_concept_links_to on concept_links(to_concept_id);
-- ============================================================================
-- REVISION / FSRS CARDS
-- ============================================================================
create table if not exists revision_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  front text not null,
  back text not null,
  card_type text default 'basic',
  
  -- FSRS-5 state
  state text default 'new' check (state in ('new','learning','review','relearning','suspended')),
  stability float default 0,
  difficulty float default 5,
  retrievability float default 1,
  
  -- Scheduling
  due_at timestamptz default now(),
  last_review_at timestamptz,
  review_count int default 0,
  lapse_count int default 0,
  
  -- Metadata
  source text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_revision_cards_due on revision_cards(user_id, due_at) where state != 'suspended';
create index idx_revision_cards_state on revision_cards(user_id, state);
create table if not exists revision_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  card_id uuid not null references revision_cards(id) on delete cascade,
  rating int not null check (rating between 1 and 4),
  prev_stability float,
  new_stability float,
  prev_difficulty float,
  new_difficulty float,
  review_duration_ms int,
  reviewed_at timestamptz default now()
);
create index idx_revision_logs_user on revision_logs(user_id, reviewed_at desc);
-- ============================================================================
-- MOCK TEST AUTOPSIES
-- ============================================================================
create table if not exists mock_autopsies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  exam text,
  test_name text,
  total_marks int,
  marks_obtained int,
  marks_lost int,
  raw_text text,
  extracted_questions jsonb,
  diagnosis jsonb,
  mistakes jsonb,
  recovery_plan jsonb,
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index idx_mock_autopsies_user on mock_autopsies(user_id, created_at desc);
create table if not exists mistakes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  autopsy_id uuid references mock_autopsies(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  category text not null check (category in (
    'conceptual_gap','silly_error','time_pressure','misread',
    'formula_recall','application','speed','exam_strategy','unknown'
  )),
  question_text text,
  user_answer text,
  correct_answer text,
  marks_lost int default 0,
  recovered boolean default false,
  recovered_at timestamptz,
  created_at timestamptz default now()
);
create index idx_mistakes_user on mistakes(user_id, created_at desc);
create index idx_mistakes_category on mistakes(user_id, category);
-- ============================================================================
-- STUDY PLANNER (COMMAND)
-- ============================================================================
create table if not exists study_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  title text not null,
  description text,
  type text not null default 'study' check (type in ('study','revise','practice','mock','break','autopsy_recovery','review')),
  subject text,
  chapter text,
  priority text default 'medium' check (priority in ('critical','high','medium','low')),
  estimated_minutes int default 45,
  scheduled_date date not null,
  is_completed boolean default false,
  completed_at timestamptz,
  focus_score int,
  notes text,
  source text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index idx_study_tasks_user_date on study_tasks(user_id, scheduled_date);
create index idx_study_tasks_incomplete on study_tasks(user_id, scheduled_date) where is_completed = false;
create table if not exists study_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  roadmap jsonb,
  progress float default 0,
  status text default 'active' check (status in ('active','completed','paused','cancelled')),
  created_at timestamptz default now()
);
-- ============================================================================
-- CHAT / MEMORY
-- ============================================================================
create table if not exists chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  summary text,
  message_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_chat_sessions_user on chat_sessions(user_id, updated_at desc);
create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  intent text,
  emotional_state text,
  metadata jsonb default '{}'::jsonb,
  tokens_used int,
  provider text,
  created_at timestamptz default now()
);
create index idx_chat_messages_session on chat_messages(session_id, created_at);
create table if not exists chat_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid references chat_sessions(id) on delete set null,
  content text not null,
  summary text,
  embedding vector(768),
  importance float default 0.5,
  memory_type text default 'episodic' check (memory_type in ('episodic','semantic','procedural')),
  created_at timestamptz default now()
);
create index idx_chat_memory_user on chat_memory(user_id);
create index idx_chat_memory_embedding on chat_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- ============================================================================
-- MATERIALS / RAG
-- ============================================================================
create table if not exists materials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  file_url text,
  file_type text,
  file_size int,
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  page_count int,
  word_count int,
  created_at timestamptz default now()
);
create table if not exists material_chunks (
  id uuid primary key default uuid_generate_v4(),
  material_id uuid not null references materials(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(768),
  metadata jsonb default '{}'::jsonb,
  page_number int,
  token_count int,
  created_at timestamptz default now()
);
create index idx_material_chunks_user on material_chunks(user_id);
create index idx_material_chunks_embedding on material_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- ============================================================================
-- STUDENT MODEL / INFERENCE
-- ============================================================================
create table if not exists student_models (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade unique,
  learning_style jsonb,
  strengths jsonb,
  weaknesses jsonb,
  behavioral_traps jsonb,
  motivational_drivers jsonb,
  confidence float default 0,
  last_inferred_at timestamptz,
  inference_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists learner_states (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  state_type text not null,
  state_value jsonb,
  confidence float,
  expires_at timestamptz,
  created_at timestamptz default now()
);
create index idx_learner_states_user on learner_states(user_id, state_type);
create table if not exists performance_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  snapshot_date date not null,
  metrics jsonb not null,
  created_at timestamptz default now(),
  unique(user_id, snapshot_date)
);
-- ============================================================================
-- EVENT BUS (already exists as function — adding tables)
-- ============================================================================
create table if not exists student_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  status text default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  retry_count int default 0,
  idempotency_key text,
  trace_id uuid default uuid_generate_v4(),
  version text default 'v2',
  metadata jsonb default '{}'::jsonb,
  last_error text,
  created_at timestamptz default now(),
  processed_at timestamptz,
  completed_at timestamptz,
  unique nulls not distinct (user_id, idempotency_key)
);
create index idx_student_events_status on student_events(status, created_at) where status in ('pending','processing');
create index idx_student_events_user on student_events(user_id, created_at desc);
create table if not exists event_consumer_tracking (
  event_id uuid not null references student_events(id) on delete cascade,
  consumer_name text not null,
  status text default 'pending' check (status in ('pending','processing','completed','failed')),
  retry_count int default 0,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (event_id, consumer_name)
);
create index idx_event_consumer_tracking_status on event_consumer_tracking(consumer_name, status);
create table if not exists dlq_events (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null,
  user_id uuid references profiles(id) on delete cascade,
  trace_id uuid,
  version text,
  type text not null,
  data jsonb not null,
  metadata jsonb default '{}'::jsonb,
  error_message text not null,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  resolution_notes text
);
create index idx_dlq_events_unresolved on dlq_events(created_at) where resolved_at is null;
-- ============================================================================
-- TRIGGERS
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();
create trigger concepts_updated_at before update on concepts
  for each row execute function update_updated_at();
create trigger revision_cards_updated_at before update on revision_cards
  for each row execute function update_updated_at();
create trigger chat_sessions_updated_at before update on chat_sessions
  for each row execute function update_updated_at();
create trigger student_models_updated_at before update on student_models
  for each row execute function update_updated_at();
-- ============================================================================
-- ROW LEVEL SECURITY — Defense in depth
-- ============================================================================

-- Enable RLS on all user-data tables
alter table profiles enable row level security;
alter table concepts enable row level security;
alter table concept_links enable row level security;
alter table revision_cards enable row level security;
alter table revision_logs enable row level security;
alter table mock_autopsies enable row level security;
alter table mistakes enable row level security;
alter table study_tasks enable row level security;
alter table study_goals enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table chat_memory enable row level security;
alter table materials enable row level security;
alter table material_chunks enable row level security;
alter table student_models enable row level security;
alter table learner_states enable row level security;
alter table performance_snapshots enable row level security;
alter table student_events enable row level security;
alter table event_consumer_tracking enable row level security;
-- ============================================================================
-- GENERIC USER-OWNED POLICY GENERATOR
-- ============================================================================
-- Explicitly handle profiles (uses 'id' instead of 'user_id')
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on profiles for delete using (auth.uid() = id);

do $$
declare
  t text;
  user_tables text[] := array[
    'concepts','concept_links','revision_cards','revision_logs',
    'mock_autopsies','mistakes','study_tasks','study_goals',
    'chat_sessions','chat_messages','chat_memory',
    'materials','material_chunks',
    'student_models','learner_states','performance_snapshots','student_events'
  ];
begin
  foreach t in array user_tables loop
    -- SELECT
    execute format('
      create policy "%I_select_own" on %I
      for select using (auth.uid() = user_id);
    ', t, t);
    
    -- INSERT
    execute format('
      create policy "%I_insert_own" on %I
      for insert with check (auth.uid() = user_id);
    ', t, t);
    
    -- UPDATE
    execute format('
      create policy "%I_update_own" on %I
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    ', t, t);
    
    -- DELETE
    execute format('
      create policy "%I_delete_own" on %I
      for delete using (auth.uid() = user_id);
    ', t, t);
  end loop;
end$$;
-- ============================================================================
-- EVENT_CONSUMER_TRACKING — special policy (joins via student_events)
-- ============================================================================
create policy "event_consumer_tracking_select_own" on event_consumer_tracking
  for select using (
    exists (
      select 1 from student_events
      where student_events.id = event_consumer_tracking.event_id
      and student_events.user_id = auth.uid()
    )
  );
-- ============================================================================
-- HYBRID SEARCH RPC (SECURITY DEFINER — but checks user_id)
-- ============================================================================
create or replace function match_chat_memory(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  p_user_id uuid default null
)
returns table (
  id uuid,
  content text,
  summary text,
  similarity float,
  importance float,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Enforce: must pass user_id, must match auth.uid()
  if p_user_id is null or p_user_id != auth.uid() then
    raise exception 'Unauthorized: user_id mismatch';
  end if;

  return query
  select
    cm.id,
    cm.content,
    cm.summary,
    1 - (cm.embedding <=> query_embedding) as similarity,
    cm.importance,
    cm.created_at
  from chat_memory cm
  where cm.user_id = p_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
  order by cm.embedding <=> query_embedding
  limit match_count;
end;
$$;
grant execute on function match_chat_memory to authenticated;
-- Similar for material_chunks
create or replace function match_material_chunks(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  p_user_id uuid default null
)
returns table (
  id uuid,
  material_id uuid,
  content text,
  similarity float,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id != auth.uid() then
    raise exception 'Unauthorized: user_id mismatch';
  end if;

  return query
  select
    mc.id, mc.material_id, mc.content,
    1 - (mc.embedding <=> query_embedding) as similarity,
    mc.metadata
  from material_chunks mc
  where mc.user_id = p_user_id
    and mc.embedding is not null
    and 1 - (mc.embedding <=> query_embedding) > match_threshold
  order by mc.embedding <=> query_embedding
  limit match_count;
end;
$$;
grant execute on function match_material_chunks to authenticated;
-- Migration: create_event_with_consumers.sql
-- This function creates an event row and associated consumer tracking rows atomically.

CREATE OR REPLACE FUNCTION public.create_event_with_consumers(
    p_user_id uuid,
    p_type text,
    p_data jsonb,
    p_idempotency_key text,
    p_source text,
    p_metadata jsonb
) RETURNS uuid AS $$
DECLARE
    v_event_id uuid;
BEGIN
    INSERT INTO student_events (
        user_id, type, data, status, retry_count, idempotency_key, trace_id, version, metadata
    ) VALUES (
        p_user_id,
        p_type,
        p_data,
        'pending',
        0,
        p_idempotency_key,
        gen_random_uuid(),
        'v2',
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_event_id;

    INSERT INTO event_consumer_tracking (event_id, consumer_name, status)
    SELECT v_event_id, unnest(ARRAY['learning_state_engine','atlas_engine','memory_engine','command_engine','concept_expansion_engine']::text[]), 'pending';

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE;
-- Migration: Semantic Cache for AI Responses

CREATE TABLE IF NOT EXISTS semantic_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_hash text NOT NULL UNIQUE,
    prompt_text text NOT NULL,
    response_text text NOT NULL,
    embedding vector(768),
    created_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    access_count integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_idx ON semantic_cache USING hnsw (embedding vector_cosine_ops);
CREATE OR REPLACE FUNCTION match_semantic_cache(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  response_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response_text,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
-- Enable Row Level Security
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
-- Deny all direct access to authenticated users (only service_role or SECURITY DEFINER RPCs can access)
CREATE POLICY "Deny all to semantic cache for authenticated users"
ON semantic_cache
FOR ALL
TO authenticated
USING (false);
-- Create missing RPC for cache access increments
CREATE OR REPLACE FUNCTION increment_cache_access(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE semantic_cache
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;
-- supabase/migrations/20260529000001_fix_schema_runtime_mismatch.sql
-- SAFETY-NET: Renames wrong-named tables to what the runtime code expects.
-- Run this ONLY if 20260528000001_initial_schema.sql was already applied with wrong names.
-- This migration is idempotent — safe to run even if tables were already correct.

-- ── Fix 1: events → student_events ──────────────────────────────────────────
DO $$
BEGIN
  -- Rename if wrong table exists and correct one does not
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_events' AND table_schema = 'public')
  THEN
    ALTER TABLE public.events RENAME TO student_events;
    -- Also rename the self-referential FK index/constraint if present
    RAISE NOTICE 'Renamed events → student_events';
  END IF;
END $$;
-- ── Fix 2: event_consumers → event_consumer_tracking ────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_consumers' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_consumer_tracking' AND table_schema = 'public')
  THEN
    ALTER TABLE public.event_consumers RENAME TO event_consumer_tracking;
    RAISE NOTICE 'Renamed event_consumers → event_consumer_tracking';
  END IF;
END $$;
-- ── Fix 3: event_dead_letter → dlq_events ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_dead_letter' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dlq_events' AND table_schema = 'public')
  THEN
    ALTER TABLE public.event_dead_letter RENAME TO dlq_events;
    RAISE NOTICE 'Renamed event_dead_letter → dlq_events';
  END IF;
END $$;
-- ── Fix 4: study_tasks column renames ───────────────────────────────────────
DO $$
BEGIN
  -- scheduled_for → scheduled_date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'scheduled_for' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'scheduled_date' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_tasks RENAME COLUMN scheduled_for TO scheduled_date;
    RAISE NOTICE 'Renamed study_tasks.scheduled_for → scheduled_date';
  END IF;

  -- category → type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'category' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'study_tasks' AND column_name = 'type' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_tasks RENAME COLUMN category TO type;
    RAISE NOTICE 'Renamed study_tasks.category → type';
  END IF;
END $$;
-- ── Fix 5: Add missing study_tasks columns if absent ────────────────────────
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS is_completed boolean default false;
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE public.study_tasks ADD COLUMN IF NOT EXISTS notes text;
-- ── Fix 6: Add missing student_events columns ────────────────────────────────
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS retry_count int default 0;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS trace_id uuid default gen_random_uuid();
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS version text default 'v2';
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS metadata jsonb default '{}'::jsonb;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.student_events ADD COLUMN IF NOT EXISTS status text default 'pending';
-- ── Fix 7: Add missing event_consumer_tracking columns ───────────────────────
ALTER TABLE public.event_consumer_tracking ADD COLUMN IF NOT EXISTS retry_count int default 0;
ALTER TABLE public.event_consumer_tracking ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.event_consumer_tracking ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();
-- ── Fix 8: Create dlq_events if completely missing ───────────────────────────
CREATE TABLE IF NOT EXISTS public.dlq_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  trace_id uuid,
  version text,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  error_message text NOT NULL DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolution_notes text
);
ALTER TABLE public.dlq_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dlq_events' AND policyname = 'Service role full access dlq'
  ) THEN
    CREATE POLICY "Service role full access dlq" ON public.dlq_events FOR ALL USING (true);
  END IF;
END $$;
-- ── Fix 9: match_chat_memory RPC — point to chat_memory not chat_memory_embeddings ──
-- The runtime writes to `chat_memory` (chatMemoryService.ts) so the RPC must read from `chat_memory`.
-- Drop old version that pointed to chat_memory_embeddings.
DROP FUNCTION IF EXISTS public.match_chat_memory(vector, float, int, uuid);
DROP FUNCTION IF EXISTS public.match_chat_memory(vector(768), float, int, uuid);
CREATE OR REPLACE FUNCTION public.match_chat_memory(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If chat_memory table exists, search it; otherwise fall back gracefully
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory' AND table_schema = 'public') THEN
    RETURN QUERY
    SELECT
      cm.id,
      cm.content,
      1 - (cm.embedding <=> query_embedding) AS similarity
    FROM public.chat_memory cm
    WHERE
      cm.user_id = p_user_id
      AND cm.embedding IS NOT NULL
      AND 1 - (cm.embedding <=> query_embedding) > match_threshold
    ORDER BY cm.embedding <=> query_embedding
    LIMIT match_count;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory_embeddings' AND table_schema = 'public') THEN
    -- Legacy fallback
    RETURN QUERY
    SELECT
      cme.id,
      cme.content,
      1 - (cme.embedding <=> query_embedding) AS similarity
    FROM public.chat_memory_embeddings cme
    WHERE
      cme.user_id = p_user_id
      AND cme.embedding IS NOT NULL
      AND 1 - (cme.embedding <=> query_embedding) > match_threshold
    ORDER BY cme.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.match_chat_memory(vector(768), float, int, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_chat_memory(vector(768), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_chat_memory(vector(768), float, int, uuid) TO service_role;
-- ── Fix 10: Ensure event_consumer_tracking RLS exists ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_consumer_tracking' AND policyname = 'Service role full access consumers'
  ) THEN
    ALTER TABLE public.event_consumer_tracking ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Service role full access consumers"
      ON public.event_consumer_tracking FOR ALL USING (true);
  END IF;
END $$;
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'global';
ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_session_type_check CHECK (session_type IN ('global', 'tutor', 'practice', 'onboarding'));
DO $$
BEGIN
  -- If 'exam' column exists, rename it to 'exam_type'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'exam' AND table_schema = 'public'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles RENAME COLUMN exam TO exam_type;';
  END IF;
END $$;
DO $$
BEGIN
  -- Always attempt to clean up the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_exam_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_exam_check;
  END IF;

  -- Normalize existing data before adding the constraint
  UPDATE public.profiles
  SET exam_type = lower(exam_type)
  WHERE exam_type IS NOT NULL;

  UPDATE public.profiles
  SET exam_type = 'other'
  WHERE exam_type IS NOT NULL AND exam_type NOT IN ('neet', 'jee', 'jee-advanced', 'other');

  -- Add the new constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_exam_type_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_exam_type_check
      CHECK (exam_type IN ('neet', 'jee', 'jee-advanced', 'other'));
  END IF;
END $$;
-- 20260529000004_create_study_sessions_and_session_cards.sql

-- Study Sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  chapter TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  focus_score INT,
  breaks_taken INT DEFAULT 0,
  notes TEXT
);
-- Session Cards
CREATE TABLE IF NOT EXISTS session_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "dayNumber" INTEGER,
  "streakDays" INTEGER,
  "focusTopic" TEXT,
  subject TEXT,
  "estimatedMinutes" INTEGER,
  rationale TEXT,
  "daysToExam" INTEGER,
  "overdueCards" INTEGER,
  "masteryPercent" INTEGER,
  "closingMessage" TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_session_cards_user_date ON session_cards(user_id, date);
-- RLS Policies
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own study_sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own session_cards" ON session_cards FOR ALL USING (auth.uid() = user_id);
-- Drop and recreate with SECURITY DEFINER so it bypasses RLS
-- (same logic as increment_cache_access already does correctly)
CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  response_text text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    sc.id,
    sc.response_text,
    1 - (sc.embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE 1 - (sc.embedding <=> query_embedding) > match_threshold
  ORDER BY sc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
-- Revoke from anon, grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.match_semantic_cache(vector(768), float, int, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_semantic_cache(vector(768), float, int, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.match_semantic_cache(vector(768), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_semantic_cache(vector(768), float, int, uuid) TO service_role;
-- event_consumer_tracking: remove the overly broad policy
-- Real access is via service_role only (EventDispatcher uses admin client)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_consumer_tracking'
    AND policyname = 'Service role full access consumers'
  ) THEN
    DROP POLICY "Service role full access consumers" ON public.event_consumer_tracking;
  END IF;
END $$;
-- authenticated users have no legitimate reason to query event_consumer_tracking directly
-- The select policy added in rls_policies migration via the loop is also wrong here
-- Drop it if it was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_consumer_tracking'
    AND policyname = 'event_consumer_tracking_select_own'
  ) THEN
    DROP POLICY "event_consumer_tracking_select_own" ON public.event_consumer_tracking;
  END IF;
END $$;
-- dlq_events: same fix
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dlq_events'
    AND policyname = 'Service role full access dlq'
  ) THEN
    DROP POLICY "Service role full access dlq" ON public.dlq_events;
  END IF;
END $$;
-- No authenticated policies on either table.
-- service_role bypasses RLS entirely — EventDispatcher admin client is unaffected.;
-- Migration: Create tutor_sessions table

create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create table if not exists tutor_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id text,
  topic text,
  summary text,
  concept_id uuid references concepts(id),
  messages jsonb default '[]'::jsonb,
  started_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS concept_id uuid references concepts(id);
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS messages jsonb default '[]'::jsonb;
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS started_at timestamptz default now();
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz default now();
ALTER TABLE tutor_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();
create index if not exists idx_tutor_sessions_user on tutor_sessions(user_id);
create index if not exists idx_tutor_sessions_session on tutor_sessions(session_id);
alter table tutor_sessions enable row level security;
DROP POLICY IF EXISTS "Users access own tutor_sessions" ON tutor_sessions;
create policy "Users access own tutor_sessions" on tutor_sessions
  for all using (auth.uid() = user_id);
DROP TRIGGER IF EXISTS tutor_sessions_updated_at ON tutor_sessions;
create trigger tutor_sessions_updated_at
  before update on tutor_sessions
  for each row execute function update_updated_at();
-- Migration: 20260529000008_event_queue_tables.sql

CREATE TYPE event_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE consumer_lock_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY_SCHEDULED', 'DLQ');
CREATE TABLE IF NOT EXISTS event_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    idempotency_key text UNIQUE,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    status event_status DEFAULT 'PENDING',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS consumer_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES event_queue(id) ON DELETE CASCADE,
    consumer_name text NOT NULL,
    status consumer_lock_status DEFAULT 'PENDING',
    worker_id text,
    lease_expires_at timestamptz,
    retry_count int DEFAULT 0,
    next_retry_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(event_id, consumer_name)
);
-- Index for efficient leasing query
CREATE INDEX idx_consumer_locks_leasing 
ON consumer_locks(status, next_retry_at, lease_expires_at);
CREATE TABLE IF NOT EXISTS event_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_lock_id uuid REFERENCES consumer_locks(id) ON DELETE CASCADE,
    worker_id text,
    error_message text,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS event_dlq (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid,
    consumer_name text,
    payload jsonb,
    last_error text,
    created_at timestamptz DEFAULT now()
);
-- Postgres Function to atomically acquire leases
CREATE OR REPLACE FUNCTION acquire_event_leases(
    p_worker_id text,
    p_limit int,
    p_lease_timeout interval
) RETURNS TABLE (
    lock_id uuid,
    event_id uuid,
    consumer_name text,
    event_type text,
    event_payload jsonb,
    event_metadata jsonb,
    user_id uuid,
    retry_count int
) AS $$
BEGIN
    RETURN QUERY
    WITH available_locks AS (
        SELECT cl.id
        FROM consumer_locks cl
        WHERE cl.status IN ('PENDING', 'RETRY_SCHEDULED')
          AND cl.next_retry_at <= now()
          AND (cl.lease_expires_at IS NULL OR cl.lease_expires_at < now())
        ORDER BY cl.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    ),
    updated_locks AS (
        UPDATE consumer_locks cl
        SET status = 'PROCESSING',
            worker_id = p_worker_id,
            lease_expires_at = now() + p_lease_timeout,
            updated_at = now()
        FROM available_locks al
        WHERE cl.id = al.id
        RETURNING cl.id, cl.event_id, cl.consumer_name, cl.retry_count
    )
    SELECT 
        ul.id, 
        ul.event_id, 
        ul.consumer_name, 
        eq.type, 
        eq.payload, 
        eq.metadata, 
        eq.user_id, 
        ul.retry_count
    FROM updated_locks ul
    JOIN event_queue eq ON eq.id = ul.event_id;
END;
$$ LANGUAGE plpgsql;
-- Replace existing create_event_with_consumers to use new tables seamlessly
CREATE OR REPLACE FUNCTION public.create_event_with_consumers(
    p_user_id uuid,
    p_type text,
    p_data jsonb,
    p_idempotency_key text,
    p_source text,
    p_metadata jsonb
) RETURNS uuid AS $$
DECLARE
    v_event_id uuid;
BEGIN
    -- Insert into event_queue. If idempotency_key exists, DO NOTHING to prevent duplicate.
    WITH inserted AS (
        INSERT INTO event_queue (
            user_id, type, payload, idempotency_key, metadata, status
        ) VALUES (
            p_user_id,
            p_type,
            p_data,
            p_idempotency_key,
            COALESCE(p_metadata, '{}'::jsonb),
            'PENDING'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
    )
    SELECT id INTO v_event_id FROM inserted;

    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM event_queue WHERE idempotency_key = p_idempotency_key;
        RETURN v_event_id; -- Already exists, idempotency guarantees no double execution
    END IF;

    -- Insert locks for consumers
    INSERT INTO consumer_locks (event_id, consumer_name, status)
    SELECT v_event_id, unnest(ARRAY['learning_state_engine','atlas_engine','memory_engine','command_engine','concept_expansion_engine']::text[]), 'PENDING';

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE;
-- supabase/migrations/20260529000009_semantic_memory_hybrid_scores.sql

-- 1. Safely rename chat_memory_embeddings if it exists and chat_memory does not
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory_embeddings' AND table_schema = 'public')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_memory' AND table_schema = 'public')
  THEN
    ALTER TABLE public.chat_memory_embeddings RENAME TO chat_memory;
    RAISE NOTICE 'Renamed chat_memory_embeddings → chat_memory';
  END IF;
END $$;
-- 2. Ensure chat_memory actually exists (fallback if initial schema somehow missed it)
CREATE TABLE IF NOT EXISTS public.chat_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid references chat_sessions(id) on delete set null,
  content text not null,
  summary text,
  embedding vector(768),
  importance float default 0.5,
  memory_type text default 'episodic' check (memory_type in ('episodic','semantic','procedural')),
  created_at timestamptz default now()
);
-- 3. Add hybrid scoring columns
ALTER TABLE public.chat_memory
ADD COLUMN IF NOT EXISTS novelty_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS emotional_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS learning_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repetition_score numeric(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS importance_score numeric(4,2) DEFAULT 0;
-- 20260529000010_upgrade_vector_indexes_to_hnsw.sql
-- HNSW is significantly more scalable for high-concurrency vector searches.

-- 1. Drop existing ivfflat indexes
DROP INDEX IF EXISTS idx_chat_memory_embedding;
DROP INDEX IF EXISTS idx_material_chunks_embedding;
-- 2. Create new hnsw indexes
CREATE INDEX IF NOT EXISTS idx_chat_memory_embedding_hnsw 
ON chat_memory USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_material_chunks_embedding_hnsw 
ON material_chunks USING hnsw (embedding vector_cosine_ops);
-- supabase/migrations/20260529000011_incremental_learner_states.sql

CREATE OR REPLACE FUNCTION update_learner_state_incrementally(
    p_user_id UUID,
    p_confidence_delta NUMERIC,
    p_retention_delta NUMERIC,
    p_velocity_delta INT
) RETURNS void AS $$
BEGIN
    INSERT INTO public.learner_states (
        user_id,
        overall_confidence,
        estimated_retention,
        weekly_velocity,
        updated_at
    )
    VALUES (
        p_user_id,
        GREATEST(0.0, LEAST(1.0, 0.5 + p_confidence_delta)),
        GREATEST(0.0, LEAST(1.0, 0.5 + p_retention_delta)),
        GREATEST(0, p_velocity_delta),
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        overall_confidence = GREATEST(0.0, LEAST(1.0, learner_states.overall_confidence + p_confidence_delta)),
        estimated_retention = GREATEST(0.0, LEAST(1.0, learner_states.estimated_retention + p_retention_delta)),
        weekly_velocity = GREATEST(0, learner_states.weekly_velocity + p_velocity_delta),
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- supabase/migrations/20260529000012_kg_durability.sql

ALTER TABLE public.concepts
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
-- Also adding the adaptation_logs table here for Personalization Tracking (Task 7)
CREATE TABLE IF NOT EXISTS public.adaptation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    adaptation_type TEXT NOT NULL, -- e.g. 'struggle_roadmap_adjustment', 'prereq_injection'
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS for adaptation_logs
ALTER TABLE public.adaptation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own adaptation logs"
ON public.adaptation_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own adaptation logs"
ON public.adaptation_logs FOR SELECT
USING (auth.uid() = user_id);
-- System service role can do all
CREATE POLICY "Service role adaptation logs all"
ON public.adaptation_logs
USING (true)
WITH CHECK (true);
-- Canonical MVP schema alignment.
-- This migration is intentionally additive/idempotent so a fresh database and an
-- already-migrated database converge on the same runtime contract.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists exam_type text,
  add column if not exists streak_days int default 0,
  add column if not exists last_active_at timestamptz,
  add column if not exists current_level text,
  add column if not exists timezone text default 'UTC';
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
-- ---------------------------------------------------------------------------
-- Learning goals
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'study_goals'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'learning_goals'
  ) then
    alter table public.study_goals rename to learning_goals;
  end if;
end $$;
create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  target_date date,
  target_completion_date timestamptz,
  current_level text,
  preferred_learning_style text,
  daily_hours_available int,
  roadmap jsonb,
  milestones jsonb,
  progress float default 0,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.learning_goals
  add column if not exists target_completion_date timestamptz,
  add column if not exists current_level text,
  add column if not exists preferred_learning_style text,
  add column if not exists daily_hours_available int,
  add column if not exists milestones jsonb,
  add column if not exists updated_at timestamptz default now();
create index if not exists idx_learning_goals_user_status
  on public.learning_goals(user_id, status);
alter table public.learning_goals enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'learning_goals' and policyname = 'Users access own learning_goals'
  ) then
    create policy "Users access own learning_goals"
      on public.learning_goals for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- ATLAS concepts and links
-- ---------------------------------------------------------------------------
alter table public.concepts
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists mastery text,
  add column if not exists confidence text default 'low',
  add column if not exists forgetting_probability float default 1.0,
  add column if not exists times_reviewed float default 0,
  add column if not exists times_correct float default 0,
  add column if not exists times_incorrect float default 0,
  add column if not exists version int default 1;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery'
  ) then
    execute 'alter table public.concepts alter column mastery type text using mastery::text';
  end if;
end $$;
do $$
declare
  v_mastery_tier text;
  v_mastery_level text;
  v_exposure_count text;
  v_correct_count text;
begin
  v_mastery_tier := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery_tier'
  ) then 'mastery_tier' else 'null::text' end;

  v_mastery_level := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'mastery_level'
  ) then 'mastery_level' else 'null::numeric' end;

  v_exposure_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'exposure_count'
  ) then 'exposure_count' else '0' end;

  v_correct_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concepts' and column_name = 'correct_count'
  ) then 'correct_count' else '0' end;

  execute format($sql$
    update public.concepts
    set mastery = coalesce(
      mastery::text,
      (case
        when %1$s::text in ('weak') then 'exposed'
        when %1$s::text in ('developing', 'proficient', 'mastered') then %1$s::text
        when %2$s::numeric >= 0.85 then 'mastered'
        when %2$s::numeric >= 0.60 then 'proficient'
        when %2$s::numeric >= 0.25 then 'developing'
        when %2$s::numeric > 0 then 'exposed'
        else 'not_started'
      end)::text
    )
  $sql$, v_mastery_tier, v_mastery_level);

  execute format($sql$
    update public.concepts
    set
      times_reviewed = coalesce(times_reviewed, %1$s, 0),
      times_correct = coalesce(times_correct, %2$s, 0),
      times_incorrect = coalesce(times_incorrect, greatest(coalesce(%1$s, 0) - coalesce(%2$s, 0), 0)),
      forgetting_probability = coalesce(forgetting_probability, 1.0),
      confidence = coalesce(confidence, 'low')
  $sql$, v_exposure_count, v_correct_count);
end $$;
create index if not exists idx_concepts_user_mastery
  on public.concepts(user_id, mastery);
create index if not exists idx_concepts_forgetting
  on public.concepts(user_id, forgetting_probability desc);
create table if not exists public.mastery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  old_mastery text,
  new_mastery text not null,
  source text not null,
  source_id text,
  evidence text,
  created_at timestamptz default now()
);
create index if not exists idx_mastery_events_user
  on public.mastery_events(user_id, created_at desc);
create index if not exists idx_mastery_events_concept
  on public.mastery_events(concept_id, created_at desc);
alter table public.mastery_events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mastery_events' and policyname = 'Users access own mastery_events'
  ) then
    create policy "Users access own mastery_events"
      on public.mastery_events for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
alter table public.concept_links
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists source_concept_id uuid,
  add column if not exists target_concept_id uuid;
do $$
declare
  v_from_concept text;
  v_to_concept text;
begin
  v_from_concept := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concept_links' and column_name = 'from_concept_id'
  ) then 'from_concept_id' else 'source_concept_id' end;

  v_to_concept := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concept_links' and column_name = 'to_concept_id'
  ) then 'to_concept_id' else 'target_concept_id' end;

  execute format($sql$
    update public.concept_links
    set
      source_concept_id = coalesce(source_concept_id, %1$s),
      target_concept_id = coalesce(target_concept_id, %2$s)
  $sql$, v_from_concept, v_to_concept);
end $$;
-- ---------------------------------------------------------------------------
-- MEMORY revision cards
-- ---------------------------------------------------------------------------
alter table public.revision_cards
  add column if not exists due timestamptz,
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists elapsed_days int default 0,
  add column if not exists scheduled_days int default 0,
  add column if not exists reps int default 0,
  add column if not exists lapses int default 0,
  add column if not exists last_review timestamptz,
  add column if not exists forgetting_probability float default 1.0;
do $$
declare
  v_due_at text;
  v_last_review_at text;
  v_review_count text;
  v_lapse_count text;
begin
  v_due_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'due_at'
  ) then 'due_at' else 'due' end;

  v_last_review_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'last_review_at'
  ) then 'last_review_at' else 'last_review' end;

  v_review_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'review_count'
  ) then 'review_count' else '0' end;

  v_lapse_count := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revision_cards' and column_name = 'lapse_count'
  ) then 'lapse_count' else '0' end;

  execute format($sql$
    update public.revision_cards
    set
      due = coalesce(due, %1$s),
      last_review = coalesce(last_review, %2$s),
      reps = coalesce(reps, %3$s, 0),
      lapses = coalesce(lapses, %4$s, 0)
  $sql$, v_due_at, v_last_review_at, v_review_count, v_lapse_count);
end $$;

alter table public.revision_cards drop constraint if exists revision_cards_state_check;
alter table public.revision_cards alter column state drop default;
alter table public.revision_cards alter column state type int using (
  case
    when state::text ~ '^[0-9]+$' then state::text::int
    when state::text = 'new' then 0
    when state::text = 'learning' then 1
    when state::text = 'review' then 2
    when state::text = 'relearning' then 3
    when state::text = 'suspended' then 4
    else 0
  end
);
alter table public.revision_cards alter column state set default 0;
alter table public.revision_cards
  add constraint revision_cards_state_check check (state between 0 and 4);

drop index if exists idx_revision_cards_due;
create index if not exists idx_revision_cards_due
  on public.revision_cards(user_id, due)
  where state != 4;
create table if not exists public.revision_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.revision_cards(id) on delete cascade,
  rating int not null check (rating between 1 and 4),
  prev_stability float,
  new_stability float,
  prev_difficulty float,
  new_difficulty float,
  review_duration_ms int,
  reviewed_at timestamptz default now()
);
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'revision_logs') then
    alter table public.revision_logs
      add column if not exists elapsed_days int,
      add column if not exists scheduled_days int,
      add column if not exists state int,
      add column if not exists response_time_ms int,
      add column if not exists created_at timestamptz default now();
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- AUTOPSY tables
-- ---------------------------------------------------------------------------
alter table public.mock_autopsies
  add column if not exists exam_type text,
  add column if not exists total_questions int default 0,
  add column if not exists correct_count int default 0,
  add column if not exists incorrect_count int default 0,
  add column if not exists unattempted_count int default 0,
  add column if not exists current_score numeric default 0,
  add column if not exists recoverable_marks numeric default 0,
  add column if not exists potential_score numeric default 0;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mock_autopsies' and column_name = 'exam'
  ) then
    execute 'update public.mock_autopsies set exam_type = coalesce(exam_type, exam)';
  end if;
end $$;
create table if not exists public.autopsy_questions (
  id uuid primary key default gen_random_uuid(),
  autopsy_id uuid not null references public.mock_autopsies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  question_number int not null,
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
  marks_lost numeric default 0,
  ocr_confidence numeric,
  created_at timestamptz default now()
);
alter table public.autopsy_questions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists subtopic text,
  add column if not exists difficulty text,
  add column if not exists status text default 'Unattempted',
  add column if not exists question_text text,
  add column if not exists correct_answer text,
  add column if not exists student_answer text,
  add column if not exists mistake_category text,
  add column if not exists reasoning text,
  add column if not exists marks_lost numeric default 0,
  add column if not exists ocr_confidence numeric,
  add column if not exists created_at timestamptz default now();
create index if not exists idx_autopsy_questions_autopsy
  on public.autopsy_questions(autopsy_id, question_number);
create index if not exists idx_autopsy_questions_user
  on public.autopsy_questions(user_id, created_at desc);
alter table public.autopsy_questions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'autopsy_questions' and policyname = 'Users access own autopsy_questions'
  ) then
    create policy "Users access own autopsy_questions"
      on public.autopsy_questions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
alter table public.mistakes drop constraint if exists mistakes_category_check;
alter table public.mistakes
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists topic text,
  add column if not exists total_marks numeric default 0,
  add column if not exists time_spent_seconds int,
  add column if not exists ai_analysis text,
  add column if not exists improvement_suggestion text,
  add column if not exists is_recurring boolean default false,
  add column if not exists occurrence_count int default 1;
-- ---------------------------------------------------------------------------
-- COMMAND study sessions and cards
-- ---------------------------------------------------------------------------
alter table public.study_sessions
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.study_sessions
  add column if not exists date date default current_date,
  add column if not exists completed_at timestamptz,
  add column if not exists topic text,
  add column if not exists concept_name text,
  add column if not exists understood boolean default false,
  add column if not exists gap_found text,
  add column if not exists cards_created int default 0,
  add column if not exists session_type text default 'study',
  add column if not exists is_completed boolean default false,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists summary text;
update public.study_sessions
set date = coalesce(ended_at, started_at, created_at)::date
where date is null;
create index if not exists idx_study_sessions_user_date
  on public.study_sessions(user_id, date);
-- ---------------------------------------------------------------------------
-- MIND tutor session state
-- ---------------------------------------------------------------------------
alter table public.tutor_sessions
  add column if not exists current_state text default 'DIAGNOSTIC',
  add column if not exists misconception_detected text,
  add column if not exists turns_count int default 0,
  add column if not exists is_completed boolean default false;
create index if not exists idx_tutor_sessions_active
  on public.tutor_sessions(user_id, is_completed, created_at desc);
-- ---------------------------------------------------------------------------
-- Student model durability
-- ---------------------------------------------------------------------------
alter table public.student_models
  add column if not exists chronic_weaknesses jsonb,
  add column if not exists fatigue_threshold_minutes int default 45,
  add column if not exists peak_productivity_hour int default 10,
  add column if not exists last_updated timestamptz,
  add column if not exists last_updated_at timestamptz;
do $$
declare
  v_type text;
begin
  select data_type into v_type from information_schema.columns
  where table_schema = 'public' and table_name = 'student_models' and column_name = 'chronic_weaknesses';
  
  if v_type is not null and v_type != 'jsonb' then
    execute 'alter table public.student_models alter column chronic_weaknesses type jsonb using to_jsonb(chronic_weaknesses)';
  end if;
end $$;
do $$
declare
  v_weaknesses text;
  v_last_inferred_at text;
  v_updated_at text;
begin
  v_weaknesses := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_models' and column_name = 'weaknesses'
  ) then 'to_jsonb(weaknesses)' else 'null::jsonb' end;

  v_last_inferred_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_models' and column_name = 'last_inferred_at'
  ) then 'last_inferred_at' else 'null::timestamptz' end;

  v_updated_at := case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_models' and column_name = 'updated_at'
  ) then 'updated_at' else 'null::timestamptz' end;

  execute format($sql$
    update public.student_models
    set
      chronic_weaknesses = coalesce(chronic_weaknesses, %1$s),
      last_updated = coalesce(last_updated, %2$s, %3$s),
      last_updated_at = coalesce(last_updated_at, last_updated, %2$s, %3$s)
  $sql$, v_weaknesses, v_last_inferred_at, v_updated_at);
end $$;
alter table public.learner_states
  add column if not exists state_type text default 'aggregate',
  add column if not exists overall_confidence numeric default 0.5,
  add column if not exists estimated_retention numeric default 0.5,
  add column if not exists weekly_velocity int default 0,
  add column if not exists updated_at timestamptz default now();
with ranked as (
  select
    id,
    row_number() over (partition by user_id, state_type order by created_at desc) as rn
  from public.learner_states
)
delete from public.learner_states ls
using ranked
where ls.id = ranked.id
  and ranked.rn > 1;
create unique index if not exists idx_learner_states_user_state_type_unique
  on public.learner_states(user_id, state_type);
create or replace function public.update_learner_state_incrementally(
  p_user_id uuid,
  p_confidence_delta numeric,
  p_retention_delta numeric,
  p_velocity_delta int
) returns void as $$
begin
  insert into public.learner_states (
    user_id,
    state_type,
    state_value,
    overall_confidence,
    estimated_retention,
    weekly_velocity,
    confidence,
    updated_at
  )
  values (
    p_user_id,
    'aggregate',
    '{}'::jsonb,
    greatest(0.0, least(1.0, 0.5 + p_confidence_delta)),
    greatest(0.0, least(1.0, 0.5 + p_retention_delta)),
    greatest(0, p_velocity_delta),
    1.0,
    now()
  )
  on conflict (user_id, state_type) do update
  set
    overall_confidence = greatest(0.0, least(1.0, public.learner_states.overall_confidence + p_confidence_delta)),
    estimated_retention = greatest(0.0, least(1.0, public.learner_states.estimated_retention + p_retention_delta)),
    weekly_velocity = greatest(0, public.learner_states.weekly_velocity + p_velocity_delta),
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;
-- ---------------------------------------------------------------------------
-- Durable global chat and long-term memory
-- ---------------------------------------------------------------------------
alter table public.chat_sessions
  add column if not exists session_type text default 'global',
  add column if not exists is_global boolean default false;
alter table public.chat_sessions
  drop constraint if exists chat_sessions_session_type_check;
with ranked as (
  select
    id,
    row_number() over (partition by user_id order by updated_at desc nulls last, created_at desc) as rn
  from public.chat_sessions
  where session_type = 'global'
)
update public.chat_sessions cs
set session_type = 'archived'
from ranked
where cs.id = ranked.id
  and ranked.rn > 1;
update public.chat_sessions
set is_global = (session_type = 'global');
create unique index if not exists idx_chat_sessions_one_global
  on public.chat_sessions(user_id)
  where session_type = 'global';
alter table public.chat_messages
  add column if not exists token_count int,
  add column if not exists estimated_cost numeric default 0;
alter table public.chat_memory drop constraint if exists chat_memory_memory_type_check;
alter table public.chat_memory
  add column if not exists source text default 'chat',
  add column if not exists importance_score numeric,
  add column if not exists novelty_score numeric,
  add column if not exists emotional_score numeric,
  add column if not exists learning_score numeric,
  add column if not exists repetition_score numeric,
  add column if not exists memory_type text default 'episodic',
  add column if not exists updated_at timestamptz default now(),
  add constraint chat_memory_memory_type_check
    check (memory_type in (
      'episodic',
      'semantic',
      'procedural',
      'learner_profile',
      'concept_gap',
      'mistake_pattern',
      'preference',
      'goal',
      'behavioral_pattern'
    ));
-- ---------------------------------------------------------------------------
-- Event locking/retry fields
-- ---------------------------------------------------------------------------
alter table public.event_queue
  add column if not exists retry_count int default 0,
  add column if not exists next_attempt_at timestamptz default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text;
alter table public.consumer_locks
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_error text;
alter table public.event_dlq
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists event_type text,
  add column if not exists event_metadata jsonb default '{}'::jsonb,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_notes text;
update public.consumer_locks
set next_attempt_at = coalesce(next_attempt_at, next_retry_at);
-- ---------------------------------------------------------------------------
-- Daily AI usage accounting
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  chat_calls int default 0,
  autopsy_calls int default 0,
  image_calls int default 0,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  total_tokens int default 0,
  estimated_cost numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, usage_date)
);
alter table public.ai_usage_daily enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_usage_daily' and policyname = 'Users view own ai_usage_daily'
  ) then
    create policy "Users view own ai_usage_daily"
      on public.ai_usage_daily for select
      using (auth.uid() = user_id);
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- Canonical event enqueue and leasing functions
-- ---------------------------------------------------------------------------
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
begin
  with inserted as (
    insert into public.event_queue (
      user_id,
      type,
      payload,
      idempotency_key,
      metadata,
      status,
      next_attempt_at
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
    unnest(array[
      'learning_state_engine',
      'atlas_engine',
      'memory_engine',
      'command_engine',
      'concept_expansion_engine',
      'chat_side_effect_engine'
    ]::text[]),
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
    where cl.status in ('PENDING', 'RETRY_SCHEDULED')
      and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now()
      and (cl.lease_expires_at is null or cl.lease_expires_at < now())
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
-- Create or replace function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, exam_type, streak_days, last_active_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'),
    'neet',
    0,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Drop trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- Backfill missing profiles
INSERT INTO public.profiles (id, email, full_name, exam_type, streak_days, last_active_at)
SELECT 
  u.id, 
  u.email, 
  COALESCE(u.raw_user_meta_data->>'full_name', 'Student'),
  'neet',
  0,
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
-- Core loop hardening: provider-neutral orchestration support, concept resolution,
-- mastery evidence, learner-state freshness, and explicit event routing.

alter table public.profiles
  add column if not exists learner_state_version int not null default 0;
alter table public.session_cards
  add column if not exists learner_state_version int not null default 0;
alter table public.concepts
  add column if not exists mastery_score numeric default 0;
create table if not exists public.concept_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz default now(),
  unique(user_id, normalized_alias)
);
create index if not exists idx_concept_aliases_concept
  on public.concept_aliases(concept_id);
alter table public.concept_aliases enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concept_aliases' and policyname = 'Users access own concept_aliases'
  ) then
    create policy "Users access own concept_aliases"
      on public.concept_aliases for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
create table if not exists public.unresolved_concept_mentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  exam_type text,
  raw_subject text,
  raw_chapter text,
  raw_topic text,
  question_text text,
  normalized_subject text,
  normalized_chapter text,
  normalized_topic text,
  confidence numeric,
  reason text,
  created_at timestamptz default now()
);
create index if not exists idx_unresolved_concept_mentions_user
  on public.unresolved_concept_mentions(user_id, created_at desc);
alter table public.unresolved_concept_mentions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unresolved_concept_mentions' and policyname = 'Users access own unresolved_concept_mentions'
  ) then
    create policy "Users access own unresolved_concept_mentions"
      on public.unresolved_concept_mentions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
create table if not exists public.concept_resolution_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  source_type text not null,
  raw_subject text,
  raw_chapter text,
  raw_topic text,
  normalized_subject text,
  normalized_chapter text,
  normalized_topic text,
  method text not null,
  confidence numeric,
  reason text,
  created_at timestamptz default now()
);
create index if not exists idx_concept_resolution_logs_user
  on public.concept_resolution_logs(user_id, created_at desc);
alter table public.concept_resolution_logs enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concept_resolution_logs' and policyname = 'Users access own concept_resolution_logs'
  ) then
    create policy "Users access own concept_resolution_logs"
      on public.concept_resolution_logs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
alter table public.mastery_events
  add column if not exists evidence_type text,
  add column if not exists weight numeric,
  add column if not exists confidence numeric,
  add column if not exists source_event_id uuid;
create unique index if not exists idx_mastery_events_idempotent_source
  on public.mastery_events(user_id, concept_id, evidence_type, source, source_id)
  where source_id is not null and evidence_type is not null;
alter table public.event_attempts
  add column if not exists result_status text,
  add column if not exists result_reason text;
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
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine','memory_engine','command_engine','learning_state_engine']
    when 'COMMAND_SESSION_COMPLETED' then array['atlas_engine','memory_engine','command_engine','learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine','memory_engine','command_engine','learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine','memory_engine','command_engine','learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine','atlas_engine']
    when 'COMMAND_TASK_COMPLETED' then array['learning_state_engine']
    when 'COMMAND_TASK_DELAYED' then array['learning_state_engine']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'COMMAND_SESSION_CREATED' then array['learning_state_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    else array[]::text[]
  end;

  if array_length(v_consumers, 1) is null then
    raise exception 'Unsupported event type: %', p_type;
  end if;

  with inserted as (
    insert into public.event_queue (
      user_id,
      type,
      payload,
      idempotency_key,
      metadata,
      status,
      next_attempt_at
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
create or replace function public.update_learner_state_incrementally(
  p_user_id uuid,
  p_confidence_delta numeric,
  p_retention_delta numeric,
  p_velocity_delta int
) returns void as $$
begin
  insert into public.learner_states (
    user_id,
    overall_confidence,
    estimated_retention,
    weekly_velocity,
    updated_at
  )
  values (
    p_user_id,
    greatest(0.0, least(1.0, 0.5 + p_confidence_delta)),
    greatest(0.0, least(1.0, 0.5 + p_retention_delta)),
    greatest(0, p_velocity_delta),
    now()
  )
  on conflict (user_id) do update
  set
    overall_confidence = greatest(0.0, least(1.0, public.learner_states.overall_confidence + p_confidence_delta)),
    estimated_retention = greatest(0.0, least(1.0, public.learner_states.estimated_retention + p_retention_delta)),
    weekly_velocity = greatest(0, public.learner_states.weekly_velocity + p_velocity_delta),
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;
-- MVP production hardening follow-up:
-- - per-call AI usage ledger and daily budget counters
-- - AUTOPSY low-confidence review state and traceability
-- - duplicate prevention for autopsy-derived mistakes/questions

alter table public.ai_usage_daily
  add column if not exists planner_calls int default 0,
  add column if not exists session_card_calls int default 0,
  add column if not exists budget_exceeded_count int default 0;
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  route text not null,
  model text not null,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  total_tokens int default 0,
  estimated_cost numeric default 0,
  created_at timestamptz default now()
);
create index if not exists idx_ai_usage_events_user_date
  on public.ai_usage_events(user_id, usage_date desc, created_at desc);
alter table public.ai_usage_events enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_usage_events' and policyname = 'Users view own ai_usage_events'
  ) then
    create policy "Users view own ai_usage_events"
      on public.ai_usage_events for select
      using (auth.uid() = user_id);
  end if;
end $$;
alter table public.autopsy_questions
  add column if not exists needs_review boolean default false,
  add column if not exists extraction_confidence numeric,
  add column if not exists trace_metadata jsonb default '{}'::jsonb;
create unique index if not exists idx_autopsy_questions_unique_question
  on public.autopsy_questions(autopsy_id, question_number);
alter table public.mistakes
  add column if not exists source_autopsy_id uuid references public.mock_autopsies(id) on delete cascade,
  add column if not exists source_question_number int,
  add column if not exists extraction_confidence numeric;
create unique index if not exists idx_mistakes_unique_autopsy_question
  on public.mistakes(user_id, source_autopsy_id, source_question_number)
  where source_autopsy_id is not null and source_question_number is not null;
-- Migration: 20260530000004_rpc_transactions.sql
-- Purpose: Provide strict transactional boundaries for study session completion and autopsy ingestion

-- 0. Add status to mistakes for confidence gating
alter table public.mistakes
  add column if not exists status text default 'pending_review' check (status in ('pending_review', 'verified_mistake', 'rejected'));
-- 1. Study Session Completion RPC

-- 1. Study Session Completion RPC
create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
begin
  -- Insert study session
  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- Create event atomically
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'COMMAND_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id
  );
end;
$$ language plpgsql security definer set search_path = public;
-- 2. Autopsy Ingestion RPC
create or replace function public.ingest_autopsy_document(
  p_user_id uuid,
  p_filename text,
  p_file_url text,
  p_file_type text,
  p_mime_type text,
  p_size_bytes bigint,
  p_metadata jsonb
) returns uuid as $$
declare
  v_document_id uuid;
begin
  insert into public.documents (
    user_id,
    filename,
    file_url,
    file_type,
    mime_type,
    size_bytes,
    status,
    metadata
  ) values (
    p_user_id,
    p_filename,
    p_file_url,
    p_file_type,
    p_mime_type,
    p_size_bytes,
    'pending',
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_document_id;
  
  return v_document_id;
end;
$$ language plpgsql security definer set search_path = public;
-- Migration: 20260530000005_mvp_critical_hardening.sql
-- Purpose: close MVP production blockers that must hold on both fresh and upgraded databases.

-- ---------------------------------------------------------------------------
-- RLS and policy repair
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);
-- ---------------------------------------------------------------------------
-- Stronger duplicate prevention and provenance
-- ---------------------------------------------------------------------------
alter table public.revision_cards
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_hash text,
  add column if not exists verified boolean not null default false,
  add column if not exists confidence numeric,
  add column if not exists origin_event_id uuid;
create unique index if not exists idx_revision_cards_unique_source
  on public.revision_cards(user_id, source_type, source_id, source_hash)
  where source_type is not null and source_id is not null and source_hash is not null;
create unique index if not exists idx_study_sessions_completion_key
  on public.study_sessions(user_id, (metadata->>'completion_key'))
  where metadata ? 'completion_key' and nullif(metadata->>'completion_key', '') is not null;
alter table public.mock_autopsies
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists trace_id uuid;
create unique index if not exists idx_mock_autopsies_user_idempotency
  on public.mock_autopsies(user_id, (metadata->>'idempotency_key'))
  where metadata ? 'idempotency_key';
alter table public.autopsy_questions
  add column if not exists evidence_status text not null default 'ignored_or_unverified',
  add column if not exists source_hash text,
  add column if not exists trace_id uuid;
alter table public.autopsy_questions
  drop constraint if exists autopsy_questions_evidence_status_check,
  add constraint autopsy_questions_evidence_status_check
    check (evidence_status in ('verified_mistake', 'needs_review', 'ignored_or_unverified', 'corrected_by_user'));
alter table public.mistakes
  drop constraint if exists mistakes_status_check;
alter table public.mistakes
  add constraint mistakes_status_check
    check (status in ('pending_review', 'verified_mistake', 'rejected', 'corrected_by_user'));
create index if not exists idx_autopsy_questions_verified
  on public.autopsy_questions(user_id, evidence_status, extraction_confidence desc)
  where evidence_status = 'verified_mistake';
create index if not exists idx_event_queue_polling
  on public.event_queue(status, next_attempt_at, created_at);
create index if not exists idx_consumer_locks_polling
  on public.consumer_locks(status, next_attempt_at, lease_expires_at, created_at);
alter table public.event_dlq
  add column if not exists attempts int default 0,
  add column if not exists last_attempt_at timestamptz;
alter table public.event_attempts
  add column if not exists event_id uuid,
  add column if not exists consumer_name text;
do $$
begin
  if exists (select 1 from pg_type where typname = 'event_status') then
    alter type event_status add value if not exists 'DLQ';
  end if;
end $$;
-- ---------------------------------------------------------------------------
-- Atomic AI budget reservation
-- ---------------------------------------------------------------------------
alter table public.ai_usage_daily
  add column if not exists reserved_cost numeric not null default 0,
  add column if not exists reserved_tokens int not null default 0,
  add column if not exists committed_cost numeric not null default 0;
create table if not exists public.ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  model text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released', 'failed')),
  estimated_cost numeric not null default 0,
  estimated_tokens int not null default 0,
  actual_cost numeric,
  actual_tokens int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_budget_reservations_user_date
  on public.ai_budget_reservations(user_id, usage_date, status);
alter table public.ai_budget_reservations enable row level security;
drop policy if exists "Users view own ai_budget_reservations" on public.ai_budget_reservations;
create policy "Users view own ai_budget_reservations"
  on public.ai_budget_reservations for select
  using (auth.uid() = user_id);
alter table public.ai_usage_events
  add column if not exists reservation_id uuid references public.ai_budget_reservations(id) on delete set null;
create or replace function public.reserve_ai_budget(
  p_user_id uuid,
  p_feature text,
  p_model text,
  p_estimated_cost numeric,
  p_estimated_tokens int,
  p_daily_limit_usd numeric default 0.25
) returns uuid as $$
declare
  v_reserved_id uuid;
  v_usage public.ai_usage_daily%rowtype;
  v_estimated_cost numeric := greatest(coalesce(p_estimated_cost, 0), 0);
  v_estimated_tokens int := greatest(coalesce(p_estimated_tokens, 0), 0);
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

  if coalesce(v_usage.estimated_cost, 0) + coalesce(v_usage.reserved_cost, 0) + v_estimated_cost > p_daily_limit_usd then
    update public.ai_usage_daily
    set budget_exceeded_count = coalesce(budget_exceeded_count, 0) + 1,
        updated_at = now()
    where id = v_usage.id;
    raise exception 'AI_DAILY_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_budget_reservations (
    user_id,
    usage_date,
    feature,
    model,
    estimated_cost,
    estimated_tokens
  ) values (
    p_user_id,
    current_date,
    p_feature,
    coalesce(nullif(p_model, ''), 'unknown'),
    v_estimated_cost,
    v_estimated_tokens
  )
  returning id into v_reserved_id;

  update public.ai_usage_daily
  set reserved_cost = coalesce(reserved_cost, 0) + v_estimated_cost,
      reserved_tokens = coalesce(reserved_tokens, 0) + v_estimated_tokens,
      updated_at = now()
  where id = v_usage.id;

  return v_reserved_id;
end;
$$ language plpgsql volatile security definer set search_path = public;
create or replace function public.commit_ai_usage(
  p_reservation_id uuid,
  p_actual_cost numeric,
  p_prompt_tokens int,
  p_completion_tokens int,
  p_route text default 'unknown'
) returns void as $$
declare
  v_reservation public.ai_budget_reservations%rowtype;
  v_prompt int := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion int := greatest(coalesce(p_completion_tokens, 0), 0);
  v_total int := greatest(coalesce(p_prompt_tokens, 0), 0) + greatest(coalesce(p_completion_tokens, 0), 0);
  v_actual_cost numeric := greatest(coalesce(p_actual_cost, 0), 0);
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  select * into v_reservation
  from public.ai_budget_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'AI_BUDGET_RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status <> 'reserved' then
    return;
  end if;

  update public.ai_budget_reservations
  set status = 'committed',
      actual_cost = v_actual_cost,
      actual_tokens = v_total,
      updated_at = now()
  where id = p_reservation_id;

  update public.ai_usage_daily
  set reserved_cost = greatest(0, coalesce(reserved_cost, 0) - coalesce(v_reservation.estimated_cost, 0)),
      reserved_tokens = greatest(0, coalesce(reserved_tokens, 0) - coalesce(v_reservation.estimated_tokens, 0)),
      committed_cost = coalesce(committed_cost, 0) + v_actual_cost,
      estimated_cost = coalesce(estimated_cost, 0) + v_actual_cost,
      prompt_tokens = coalesce(prompt_tokens, 0) + v_prompt,
      completion_tokens = coalesce(completion_tokens, 0) + v_completion,
      total_tokens = coalesce(total_tokens, 0) + v_total,
      chat_calls = coalesce(chat_calls, 0) + case when v_reservation.feature = 'chat' then 1 else 0 end,
      autopsy_calls = coalesce(autopsy_calls, 0) + case when v_reservation.feature = 'autopsy' then 1 else 0 end,
      image_calls = coalesce(image_calls, 0) + case when v_reservation.feature = 'image' then 1 else 0 end,
      planner_calls = coalesce(planner_calls, 0) + case when v_reservation.feature = 'planner' then 1 else 0 end,
      session_card_calls = coalesce(session_card_calls, 0) + case when v_reservation.feature = 'session-card' then 1 else 0 end,
      updated_at = now()
  where user_id = v_reservation.user_id and usage_date = v_reservation.usage_date;

  insert into public.ai_usage_events (
    reservation_id,
    user_id,
    usage_date,
    feature,
    route,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost
  ) values (
    p_reservation_id,
    v_reservation.user_id,
    v_reservation.usage_date,
    v_reservation.feature,
    coalesce(nullif(p_route, ''), 'unknown'),
    v_reservation.model,
    v_prompt,
    v_completion,
    v_total,
    v_actual_cost
  );
end;
$$ language plpgsql volatile security definer set search_path = public;
create or replace function public.release_ai_budget(
  p_reservation_id uuid
) returns void as $$
declare
  v_reservation public.ai_budget_reservations%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  select * into v_reservation
  from public.ai_budget_reservations
  where id = p_reservation_id
  for update;

  if not found or v_reservation.status <> 'reserved' then
    return;
  end if;

  update public.ai_budget_reservations
  set status = 'released',
      updated_at = now()
  where id = p_reservation_id;

  update public.ai_usage_daily
  set reserved_cost = greatest(0, coalesce(reserved_cost, 0) - coalesce(v_reservation.estimated_cost, 0)),
      reserved_tokens = greatest(0, coalesce(reserved_tokens, 0) - coalesce(v_reservation.estimated_tokens, 0)),
      updated_at = now()
  where user_id = v_reservation.user_id and usage_date = v_reservation.usage_date;
end;
$$ language plpgsql volatile security definer set search_path = public;
-- ---------------------------------------------------------------------------
-- Security-definer hardening and transactional MVP RPCs
-- ---------------------------------------------------------------------------
create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_existing record;
  v_profile record;
  v_started_at timestamptz;
  v_ended_at timestamptz := now();
  v_today date := current_date;
  v_last_active_date date;
  v_streak_days int := 0;
  v_streak_changed boolean := false;
  v_weight numeric;
  v_score numeric;
  v_new_mastery text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_completion_key is not null then
    select id, subject, chapter, metadata
    into v_existing
    from public.study_sessions
    where user_id = p_user_id
      and metadata->>'completion_key' = p_completion_key
    limit 1;

    if found then
      select coalesce(streak_days, 0) as streak_days
      into v_profile
      from public.profiles
      where id = p_user_id;

      return jsonb_build_object(
        'session_id', v_existing.id,
        'event_id', null,
        'concept_id', p_concept_id,
        'streak_days', coalesce(v_profile.streak_days, 0),
        'streak_changed', false,
        'idempotent_replay', true
      );
    end if;
  end if;

  select streak_days, last_active_at
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if p_task_id is not null then
    update public.study_tasks
    set is_completed = true,
        completed_at = coalesce(completed_at, v_ended_at)
    where id = p_task_id and user_id = p_user_id;

    if not found then
      raise exception 'study task not found or not owned by user';
    end if;
  end if;

  v_last_active_date := case
    when v_profile.last_active_at is null then null
    else v_profile.last_active_at::date
  end;
  v_streak_days := coalesce(v_profile.streak_days, 0);

  if v_last_active_date is distinct from v_today then
    v_streak_days := case
      when v_last_active_date = v_today - 1 then v_streak_days + 1
      else 1
    end;
    v_streak_changed := true;
  end if;

  update public.profiles
  set streak_days = v_streak_days,
      last_active_at = v_ended_at,
      learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at = v_ended_at
  where id = p_user_id;

  v_started_at := v_ended_at - (greatest(coalesce(p_duration_minutes, 1), 1) || ' minutes')::interval;

  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    coalesce(nullif(p_subject, ''), 'General'),
    coalesce(nullif(p_chapter, ''), 'Session'),
    coalesce(nullif(p_topic, ''), coalesce(nullif(p_chapter, ''), 'Session')),
    coalesce(nullif(p_concept_name, ''), coalesce(nullif(p_chapter, ''), 'Session')),
    v_started_at,
    v_ended_at,
    v_ended_at,
    greatest(coalesce(p_duration_minutes, 1), 1),
    coalesce(p_understood, true),
    p_gap_found,
    coalesce(p_cards_created, 0),
    coalesce(nullif(p_session_type, ''), 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || coalesce(p_chapter, 'Session') || ' (' || coalesce(p_subject, 'General') || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', coalesce(p_source, 'complete_session'),
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'COMMAND_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', coalesce(p_understood, true),
      'gapFound', p_gap_found,
      'cardsCreated', coalesce(p_cards_created, 0),
      'understandingGained', coalesce(p_understood, true),
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, coalesce(p_source, 'complete_session') || ':' || v_session_id::text),
    coalesce(p_source, 'complete_session'),
    jsonb_build_object('source', coalesce(p_source, 'complete_session'))
  );

  if p_concept_id is not null then
    v_weight := case when coalesce(p_understood, true) then 6 else -8 end;

    insert into public.mastery_events (
      user_id,
      concept_id,
      old_mastery,
      new_mastery,
      source,
      source_id,
      source_event_id,
      evidence,
      evidence_type,
      weight,
      confidence
    )
    select
      p_user_id,
      p_concept_id,
      c.mastery,
      c.mastery,
      case when p_source = 'session_close' then 'session_close' else 'tutor_session' end,
      v_session_id::text,
      v_event_id,
      case when coalesce(p_understood, true)
        then 'Completed session on ' || coalesce(p_chapter, 'Session')
        else 'Session on ' || coalesce(p_chapter, 'Session') || ' surfaced gap' || coalesce(': ' || p_gap_found, '')
      end,
      case when coalesce(p_understood, true) then 'tutor_understood' else 'tutor_confused' end,
      v_weight,
      0.9
    from public.concepts c
    where c.id = p_concept_id and c.user_id = p_user_id
    on conflict do nothing;

    select coalesce(sum(coalesce(weight, 0)), 0)
    into v_score
    from public.mastery_events
    where user_id = p_user_id and concept_id = p_concept_id;

    v_score := case when v_score < 0 then 12 else least(100, v_score) end;
    v_new_mastery := case
      when v_score >= 95 then 'automated'
      when v_score >= 85 then 'mastered'
      when v_score >= 60 then 'proficient'
      when v_score >= 25 then 'developing'
      when v_score > 0 then 'exposed'
      else 'not_started'
    end;

    update public.concepts
    set mastery = v_new_mastery,
        mastery_score = v_score,
        confidence = case when v_score >= 60 then 'medium' else 'low' end,
        last_reviewed_at = v_ended_at,
        updated_at = v_ended_at
    where id = p_concept_id and user_id = p_user_id;
  end if;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'concept_id', p_concept_id,
    'streak_days', v_streak_days,
    'streak_changed', v_streak_changed,
    'idempotent_replay', false
  );
end;
$$ language plpgsql volatile security definer set search_path = public;
create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_existing record;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'autopsy idempotency key required';
  end if;

  select id, metadata->>'event_id' as event_id
  into v_existing
  from public.mock_autopsies
  where user_id = p_user_id
    and metadata->>'idempotency_key' = p_idempotency_key
  limit 1;

  if found then
    return jsonb_build_object(
      'autopsy_id', v_existing.id,
      'event_id', v_existing.event_id,
      'idempotent_replay', true
    );
  end if;

  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    metadata,
    trace_id
  ) values (
    p_user_id,
    coalesce(nullif(p_test_name, ''), 'Mock Test Autopsy'),
    coalesce(nullif(p_exam_type, ''), 'General Study'),
    greatest(coalesce(p_total_questions, 0), 0),
    greatest(coalesce(p_correct_count, 0), 0),
    greatest(coalesce(p_incorrect_count, 0), 0),
    greatest(coalesce(p_unattempted_count, 0), 0),
    coalesce(p_current_score, 0),
    coalesce(p_recoverable_marks, 0),
    coalesce(p_potential_score, 0),
    'processing',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'confidence_threshold', p_confidence_threshold
    ),
    p_trace_id
  ) returning id into v_autopsy_id;

  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce((v_question->>'questionNumber')::int, (v_question->>'question_number')::int);
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false) or v_confidence < p_confidence_threshold;
    v_evidence_status := case
      when v_needs_review then 'needs_review'
      when v_status = 'Incorrect' then 'verified_mistake'
      else 'ignored_or_unverified'
    end;
    v_source_hash := md5(v_autopsy_id::text || ':' || coalesce(v_question_number::text, '') || ':' || coalesce(v_question->>'questionText', '') || ':' || coalesce(v_question->>'correctAnswer', ''));

    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id', p_trace_id,
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review', v_needs_review,
        'source_autopsy_id', v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
    set extraction_confidence = excluded.extraction_confidence
    returning id into v_question_id;

    if v_evidence_status = 'verified_mistake' then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown'),
        'verified_mistake',
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number) where source_autopsy_id is not null and source_question_number is not null
      do nothing;

      v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
        'questionNumber', v_question_number,
        'subject', v_question->>'subject',
        'chapter', v_question->>'chapter',
        'mistakeCategory', v_question->>'mistakeCategory',
        'reasoning', v_question->>'reasoning',
        'correctExplanation', v_question->>'correctExplanation',
        'conceptualGap', v_question->>'conceptualGap',
        'status', 'verified_mistake',
        'extraction_confidence', v_confidence,
        'extractionConfidence', v_confidence,
        'needs_review', false,
        'needsReview', false,
        'source_question_id', v_question_id,
        'sourceQuestionId', v_question_id,
        'source_autopsy_id', v_autopsy_id,
        'sourceAutopsyId', v_autopsy_id,
        'trace_id', p_trace_id
      ));
    end if;
  end loop;

  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId', v_autopsy_id,
      'testName', p_test_name,
      'examType', p_exam_type,
      'rawScore', p_current_score,
      'recoverableScore', coalesce(p_current_score, 0) + coalesce(p_recoverable_marks, 0),
      'potentialScore', p_potential_score,
      'totalQuestions', p_total_questions,
      'correctCount', p_correct_count,
      'incorrectCount', p_incorrect_count,
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source', 'autopsy_engine',
      'autopsyId', v_autopsy_id,
      'trace_id', p_trace_id,
      'wrongQuestions', v_wrong_questions
    )
  );

  update public.mock_autopsies
  set status = 'completed',
      completed_at = now(),
      metadata = metadata || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id', v_autopsy_id,
    'event_id', v_event_id,
    'idempotent_replay', false
  );
exception when others then
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
create or replace function public.ingest_autopsy_document(
  p_user_id uuid,
  p_filename text,
  p_file_url text,
  p_file_type text,
  p_mime_type text,
  p_size_bytes bigint,
  p_metadata jsonb
) returns uuid as $$
declare
  v_document_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  insert into public.documents (
    user_id,
    filename,
    file_url,
    file_type,
    mime_type,
    size_bytes,
    status,
    metadata
  ) values (
    p_user_id,
    p_filename,
    p_file_url,
    p_file_type,
    p_mime_type,
    p_size_bytes,
    'pending',
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_document_id;

  return v_document_id;
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) from public, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) to service_role;
revoke execute on function public.acquire_event_leases(text, int, interval) from public, authenticated;
grant execute on function public.acquire_event_leases(text, int, interval) to service_role;
revoke execute on function public.reserve_ai_budget(uuid, text, text, numeric, int, numeric) from public, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, text, numeric, int, numeric) to service_role;
revoke execute on function public.commit_ai_usage(uuid, numeric, int, int, text) from public, authenticated;
grant execute on function public.commit_ai_usage(uuid, numeric, int, int, text) to service_role;
revoke execute on function public.release_ai_budget(uuid) from public, authenticated;
grant execute on function public.release_ai_budget(uuid) to service_role;
revoke execute on function public.complete_study_session(uuid, text, text, text, text, int, boolean, text, int, text, uuid, uuid, text, text) from public;
grant execute on function public.complete_study_session(uuid, text, text, text, text, int, boolean, text, int, text, uuid, uuid, text, text) to authenticated;
revoke execute on function public.ingest_mock_autopsy(uuid, text, text, int, int, int, int, numeric, numeric, numeric, jsonb, text, uuid, numeric) from public;
grant execute on function public.ingest_mock_autopsy(uuid, text, text, int, int, int, int, numeric, numeric, numeric, jsonb, text, uuid, numeric) to authenticated;
revoke execute on function public.ingest_autopsy_document(uuid, text, text, text, text, bigint, jsonb) from public;
grant execute on function public.ingest_autopsy_document(uuid, text, text, text, text, bigint, jsonb) to authenticated;
-- Migration: 20260530000006_rpc_security_lockdown.sql
-- Purpose: Complete security definer RPC lockdown for any missing functions

create or replace function public.update_learner_state_incrementally(
  p_user_id uuid,
  p_confidence_delta numeric,
  p_retention_delta numeric,
  p_velocity_delta int
) returns void as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  insert into public.learner_states (
    user_id,
    overall_confidence,
    estimated_retention,
    weekly_velocity,
    updated_at
  )
  values (
    p_user_id,
    greatest(0.0, least(1.0, 0.5 + p_confidence_delta)),
    greatest(0.0, least(1.0, 0.5 + p_retention_delta)),
    greatest(0, p_velocity_delta),
    now()
  )
  on conflict (user_id) do update
  set
    overall_confidence = greatest(0.0, least(1.0, public.learner_states.overall_confidence + p_confidence_delta)),
    estimated_retention = greatest(0.0, least(1.0, public.learner_states.estimated_retention + p_retention_delta)),
    weekly_velocity = greatest(0, public.learner_states.weekly_velocity + p_velocity_delta),
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;
-- Migration: 20260530000007_autopsy_pending_review.sql
-- Purpose: Force manual review for all extracted mistakes to prevent AI OCR from corrupting mastery scores.

create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    p_total_questions,
    p_correct_count,
    p_incorrect_count,
    p_unattempted_count,
    p_current_score,
    p_recoverable_marks,
    p_potential_score,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce((v_question->>'questionNumber')::int, (v_question->>'question_number')::int);
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false) or v_confidence < p_confidence_threshold;
    
    -- FORCE MANUAL REVIEW FOR ALL MISTAKES
    v_evidence_status := case
      when v_needs_review then 'needs_review'
      when v_status = 'Incorrect' then 'pending_review'
      else 'ignored_or_unverified'
    end;
    v_source_hash := md5(v_autopsy_id::text || ':' || coalesce(v_question_number::text, '') || ':' || coalesce(v_question->>'questionText', '') || ':' || coalesce(v_question->>'correctAnswer', ''));

    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id', p_trace_id,
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review', v_needs_review,
        'source_autopsy_id', v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
    set extraction_confidence = excluded.extraction_confidence
    returning id into v_question_id;

    if v_evidence_status = 'pending_review' or v_evidence_status = 'verified_mistake' then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown'),
        v_evidence_status,
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number) where source_autopsy_id is not null and source_question_number is not null
      do nothing;

      v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
        'questionNumber', v_question_number,
        'subject', v_question->>'subject',
        'chapter', v_question->>'chapter',
        'mistakeCategory', v_question->>'mistakeCategory',
        'reasoning', v_question->>'reasoning',
        'correctExplanation', v_question->>'correctExplanation',
        'conceptualGap', v_question->>'conceptualGap',
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'extractionConfidence', v_confidence,
        'needs_review', v_needs_review,
        'needsReview', v_needs_review,
        'source_question_id', v_question_id,
        'sourceQuestionId', v_question_id,
        'source_autopsy_id', v_autopsy_id,
        'sourceAutopsyId', v_autopsy_id,
        'trace_id', p_trace_id
      ));
    end if;
  end loop;

  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId', v_autopsy_id,
      'testName', p_test_name,
      'examType', p_exam_type,
      'rawScore', p_current_score,
      'recoverableScore', coalesce(p_current_score, 0) + coalesce(p_recoverable_marks, 0),
      'potentialScore', p_potential_score,
      'totalQuestions', p_total_questions,
      'correctCount', p_correct_count,
      'incorrectCount', p_incorrect_count,
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source', 'autopsy_engine',
      'autopsyId', v_autopsy_id,
      'trace_id', p_trace_id,
      'wrongQuestions', v_wrong_questions
    )
  );

  update public.mock_autopsies
  set status = 'completed',
      completed_at = now(),
      metadata = metadata || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id', v_autopsy_id,
    'event_id', v_event_id,
    'idempotent_replay', false
  );
exception when others then
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
-- Migration: 20260530000008_atomic_ai_budget.sql
-- Purpose: Combine AI budget check and spend into a single atomic transaction.

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

  insert into public.ai_usage_logs (
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
-- Migration: 20260530000009_event_worker_health.sql
-- Purpose: Fix event worker locks staying stuck forever if a worker crashes mid-process.

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
        -- Standard pending or scheduled retry
        (cl.status in ('PENDING', 'RETRY_SCHEDULED') and coalesce(cl.next_attempt_at, cl.next_retry_at, now()) <= now())
        or 
        -- Recover crashed workers (stuck in PROCESSING with expired lease)
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
revoke execute on function public.acquire_event_leases(text, int, interval) from public, authenticated;
grant execute on function public.acquire_event_leases(text, int, interval) to service_role;
-- Migration: 20260530000010_atlas_orphan_cleanup.sql
-- Purpose: Audit revealed 'student_nodes' and 'mastery_edges' DO NOT EXIST in the schema.
-- The claim is hallucinated/legacy. Trusting only executable code.
-- No action required.
select 1;
-- Migration: 20260530000011_autopsy_validation.sql
-- Purpose: Prevent malicious students from spoofing autopsy scores by recalculating them securely in Postgres
-- and restricting execution to the service_role (requiring AI analysis on backend).

create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;
  
  -- Validation variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  -- ONLY allow service_role to prevent client-side spoofing bypassing AI extraction
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized: mock autopsies must be processed via the backend AI engine';
  end if;

  -- 1. Securely compute aggregates directly from the questions array
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      -- If mistake category is recoverable
      if v_question->>'mistakeCategory' in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
         v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- 2. Insert using computed values, ignoring client-provided aggregates
  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
    v_computed_correct_count,
    v_computed_incorrect_count,
    v_computed_unattempted_count,
    v_computed_score,
    v_computed_recoverable,
    v_computed_potential,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  -- 3. Process questions
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce((v_question->>'questionNumber')::int, (v_question->>'question_number')::int);
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false) or v_confidence < p_confidence_threshold;
    
    v_evidence_status := case
      when v_needs_review then 'needs_review'
      when v_status = 'Incorrect' then 'pending_review'
      else 'ignored_or_unverified'
    end;
    v_source_hash := md5(v_autopsy_id::text || ':' || coalesce(v_question_number::text, '') || ':' || coalesce(v_question->>'questionText', '') || ':' || coalesce(v_question->>'correctAnswer', ''));

    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id', p_trace_id,
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review', v_needs_review,
        'source_autopsy_id', v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
    set extraction_confidence = excluded.extraction_confidence
    returning id into v_question_id;

    if v_evidence_status = 'pending_review' or v_evidence_status = 'verified_mistake' then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown'),
        v_evidence_status,
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number) where source_autopsy_id is not null and source_question_number is not null
      do nothing;

      v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
        'questionNumber', v_question_number,
        'subject', v_question->>'subject',
        'chapter', v_question->>'chapter',
        'mistakeCategory', v_question->>'mistakeCategory',
        'reasoning', v_question->>'reasoning',
        'correctExplanation', v_question->>'correctExplanation',
        'conceptualGap', v_question->>'conceptualGap',
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'extractionConfidence', v_confidence,
        'needs_review', v_needs_review,
        'needsReview', v_needs_review,
        'source_question_id', v_question_id,
        'sourceQuestionId', v_question_id,
        'source_autopsy_id', v_autopsy_id,
        'sourceAutopsyId', v_autopsy_id,
        'trace_id', p_trace_id
      ));
    end if;
  end loop;

  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId', v_autopsy_id,
      'testName', p_test_name,
      'examType', p_exam_type,
      'rawScore', v_computed_score,
      'recoverableScore', coalesce(v_computed_score, 0) + coalesce(v_computed_recoverable, 0),
      'potentialScore', v_computed_potential,
      'totalQuestions', jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount', v_computed_correct_count,
      'incorrectCount', v_computed_incorrect_count,
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source', 'autopsy_engine',
      'autopsyId', v_autopsy_id,
      'trace_id', p_trace_id,
      'wrongQuestions', v_wrong_questions
    )
  );

  update public.mock_autopsies
  set status = 'completed',
      completed_at = now(),
      metadata = metadata || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id', v_autopsy_id,
    'event_id', v_event_id,
    'idempotent_replay', false
  );
exception when others then
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
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
-- Migration: 20260530000013_expire_stale_ai_reservations.sql
-- Purpose: Expire stale AI budget reservations to free up budget.

CREATE OR REPLACE FUNCTION public.expire_stale_ai_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN 
    SELECT id, user_id, usage_date, estimated_cost, estimated_tokens 
    FROM public.ai_budget_reservations 
    WHERE status = 'reserved' AND created_at < NOW() - INTERVAL '5 minutes'
  LOOP
    UPDATE public.ai_budget_reservations
    SET status = 'released', updated_at = NOW()
    WHERE id = v_rec.id;

    UPDATE public.ai_usage_daily
    SET reserved_cost = GREATEST(0, COALESCE(reserved_cost, 0) - COALESCE(v_rec.estimated_cost, 0)),
        reserved_tokens = GREATEST(0, COALESCE(reserved_tokens, 0) - COALESCE(v_rec.estimated_tokens, 0)),
        updated_at = NOW()
    WHERE user_id = v_rec.user_id AND usage_date = v_rec.usage_date;
  END LOOP;
END;
$$;
-- Revoke and grant as needed
REVOKE EXECUTE ON FUNCTION public.expire_stale_ai_reservations() FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_ai_reservations() TO service_role;
-- 040_chat_message_idempotency.sql
-- MODULE 3: Prevent duplicate assistant message writes across route branches and worker retries.
--
-- The route is the canonical writer of assistant messages.
-- The event worker must never insert a second row for the same assistant response.
-- We enforce this with a deterministic idempotency_key written by the route and a unique
-- partial index (NULL keys are excluded so legacy rows are unaffected).

-- 1. Add the column (safe: IF NOT EXISTS, no default, nullable = backward compatible)
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS idempotency_key text;
-- 2. Unique partial index — only rows that carry a key participate in the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_idempotency_key_idx
  ON chat_messages (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
-- =============================================================================
-- MODULE 5: SESSION CARD HARDENING
-- Migration: 20260530000012_session_card_hardening.sql
-- =============================================================================
-- Adds deterministic-selector columns to session_cards so the API can
-- store and re-hydrate all source signals without an extra DB round-trip.
--
-- Columns added:
--   task_type          – P1-P6 priority bucket
--   resource_type      – how to study (flashcard_review, practice_questions…)
--   target_concept_id  – FK to concepts (nullable for onboarding/goal_sprint)
--   priority           – same as task_type, stored for display
--   is_completed       – true after user finishes the session
--   completed_at       – timestamp of completion
--   selection_reason   – deterministic explanation string
--   mistake_count      – number of recent mistakes at selection time
--   weak_concept_count – number of weak concepts at selection time
--   has_active_goal    – whether a goal was present
--   "taskType"         – camelCase alias (matches existing JS column convention)
--   "resourceType"     – camelCase alias
--   "targetConceptId"  – camelCase alias
--   "isCompleted"      – camelCase alias
--   "completedAt"      – camelCase alias
--   "selectionReason"  – camelCase alias
--   "mistakeCount"     – camelCase alias
--   "weakConceptCount" – camelCase alias
--   "hasActiveGoal"    – camelCase alias
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: New structural columns (snake_case canonical)
-- ---------------------------------------------------------------------------

ALTER TABLE public.session_cards
  ADD COLUMN IF NOT EXISTS task_type          TEXT,
  ADD COLUMN IF NOT EXISTS resource_type      TEXT,
  ADD COLUMN IF NOT EXISTS target_concept_id  UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority           TEXT,
  ADD COLUMN IF NOT EXISTS is_completed       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS mistake_count      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weak_concept_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_active_goal    BOOLEAN DEFAULT FALSE;
-- ---------------------------------------------------------------------------
-- Step 2: camelCase aliases used by the JS ORM layer
-- (The existing schema already has "dayNumber", "streakDays" etc. in quotes;
--  we follow the same convention for new columns.)
-- ---------------------------------------------------------------------------

ALTER TABLE public.session_cards
  ADD COLUMN IF NOT EXISTS "taskType"          TEXT,
  ADD COLUMN IF NOT EXISTS "resourceType"      TEXT,
  ADD COLUMN IF NOT EXISTS "targetConceptId"   UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "isCompleted"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "completedAt"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "selectionReason"   TEXT,
  ADD COLUMN IF NOT EXISTS "mistakeCount"      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "weakConceptCount"  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "hasActiveGoal"     BOOLEAN DEFAULT FALSE;
-- ---------------------------------------------------------------------------
-- Step 3: Back-fill existing rows with sensible defaults
-- ---------------------------------------------------------------------------

UPDATE public.session_cards
SET
  task_type          = COALESCE(task_type, 'concept_study'),
  resource_type      = COALESCE(resource_type, 'practice_questions'),
  priority           = COALESCE(priority, 'concept_study'),
  "taskType"         = COALESCE("taskType", 'concept_study'),
  "resourceType"     = COALESCE("resourceType", 'practice_questions'),
  is_completed       = COALESCE(is_completed, FALSE),
  "isCompleted"      = COALESCE("isCompleted", FALSE)
WHERE task_type IS NULL OR "taskType" IS NULL;
-- ---------------------------------------------------------------------------
-- Step 4: Index for fast completed-card lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_session_cards_completed
  ON public.session_cards(user_id, date, "isCompleted");
CREATE INDEX IF NOT EXISTS idx_session_cards_concept
  ON public.session_cards("targetConceptId")
  WHERE "targetConceptId" IS NOT NULL;
-- ---------------------------------------------------------------------------
-- Step 5: RPC — complete_daily_session_card
-- Marks the session card as completed AND bumps learner_state_version atomically.
-- Called from POST /api/study-sessions or POST /api/dashboard/session-card/complete.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_daily_session_card(
  p_user_id   UUID,
  p_date      DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_updated   INT;
  v_version   INT;
BEGIN
  -- Mark card completed
  UPDATE public.session_cards
  SET
    "isCompleted"  = TRUE,
    "completedAt"  = NOW(),
    is_completed   = TRUE,
    completed_at   = NOW()
  WHERE user_id = p_user_id
    AND date    = p_date
    AND ("isCompleted" = FALSE OR "isCompleted" IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Bump learner state version so tomorrow's card regenerates with fresh signals
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, DATE) TO authenticated;
-- ---------------------------------------------------------------------------
-- Step 6: RPC — invalidate_session_card
-- Deletes today + tomorrow session_cards and bumps version.
-- Safe to call from edge functions / workers without TS import.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invalidate_session_card(
  p_user_id UUID,
  p_reason  TEXT DEFAULT 'manual_invalidation'
) RETURNS JSONB AS $$
DECLARE
  v_version INT;
  v_deleted INT := 0;
BEGIN
  -- Delete today and tomorrow
  DELETE FROM public.session_cards
  WHERE user_id = p_user_id
    AND date IN (CURRENT_DATE, CURRENT_DATE + 1);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Bump version
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'deleted', v_deleted,
    'newVersion', v_version,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.invalidate_session_card(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.invalidate_session_card(UUID, TEXT) TO authenticated;
-- ---------------------------------------------------------------------------
-- Step 7: Ensure unique constraint on (user_id, date) — defensive
-- (Already added in 20260529000004 but may be missing on older DBs)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_cards_user_id_date_key'
      AND conrelid = 'public.session_cards'::regclass
  ) THEN
    ALTER TABLE public.session_cards ADD CONSTRAINT session_cards_user_id_date_key
      UNIQUE (user_id, date);
  END IF;
END $$;
-- Migration: 20260531000001_autopsy_verified_pipeline.sql
-- Purpose: Fix autopsy pipeline so high-confidence mistakes reach verified_mistake status
--          and mutate ATLAS + MEMORY via the event system. Low-confidence items stay
--          in pending_review and MUST NOT mutate learner state.
--
-- Root bug fixed: the previous implementation always assigned 'pending_review' to
-- incorrect questions, making the isVerifiedAutopsyMistake() guard block all
-- downstream consumers (AtlasConsumer, MemoryConsumer, CommandConsumer).
--
-- Three-tier evidence_status routing (unchanged from previous migration):
--   verified_mistake    → confidence >= threshold AND not flagged needsReview
--                         → allowed to update ATLAS mastery + create MEMORY cards
--   pending_review      → confidence < threshold OR flagged needsReview
--                         → stored for manual review, NO learner state mutations
--   needs_review        → explicit needsReview flag (usually OCR issues)
--                         → stored for manual review, NO learner state mutations
--
-- Idempotency: early-return on duplicate idempotency_key (e.g. client retry on timeout)
-- Deduplication: ON CONFLICT guards on autopsy_questions and mistakes tables

create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;

  -- Idempotency guard
  v_existing_autopsy_id uuid;
  v_existing_metadata jsonb;

  -- Secure server-side recompute variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  -- SECURITY: Only service_role can call this (prevents client-side score spoofing)
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized: mock autopsies must be processed via the backend AI engine';
  end if;

  -- ─── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
  -- If this upload was already processed (e.g. client retry after timeout),
  -- return the original result without re-inserting or re-publishing.
  if p_idempotency_key is not null then
    select id, metadata into v_existing_autopsy_id, v_existing_metadata
    from public.mock_autopsies
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_autopsy_id is not null then
      return jsonb_build_object(
        'autopsy_id', v_existing_autopsy_id,
        'event_id',   coalesce(v_existing_metadata->>'event_id', null),
        'idempotent_replay', true
      );
    end if;
  end if;

  -- ─── STEP 1: Securely recompute aggregates from questions array ───────────
  -- We ignore client-provided counts/scores and derive them server-side.
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost  := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score     := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      -- Only recoverable categories contribute to recoverable marks
      if v_question->>'mistakeCategory' in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
        v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- ─── STEP 2: Insert mock_autopsies row ───────────────────────────────────
  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
    v_computed_correct_count,
    v_computed_incorrect_count,
    v_computed_unattempted_count,
    v_computed_score,
    v_computed_recoverable,
    v_computed_potential,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  -- ─── STEP 3: Process each question ───────────────────────────────────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce(
      nullif(v_question->>'questionNumber', '')::int,
      nullif(v_question->>'question_number', '')::int
    );
    v_status := coalesce(v_question->>'status', 'Unattempted');

    -- Resolve confidence: prefer extractionConfidence, fall back to ocrConfidence, default 100
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );

    -- needsReview flag wins over confidence calculation
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false)
                      or v_confidence < p_confidence_threshold;

    -- ─── THREE-TIER ROUTING ────────────────────────────────────────────────
    -- THIS IS THE CRITICAL FIX: previous code never assigned 'verified_mistake'
    -- because the CASE only checked needs_review or Incorrect — never both
    -- conditions together.
    --
    -- verified_mistake  → high-confidence incorrect answer → safe to update ATLAS/MEMORY
    -- pending_review    → low-confidence incorrect answer  → stored, no state mutations
    -- needs_review      → OCR/extraction flags raised      → stored, no state mutations
    -- ignored_or_unverified → correct/unattempted          → not stored in mistakes table
    v_evidence_status := case
      when v_needs_review                                                     then 'needs_review'
      when v_status = 'Incorrect' and v_confidence >= p_confidence_threshold  then 'verified_mistake'
      when v_status = 'Incorrect'                                              then 'pending_review'
      else                                                                          'ignored_or_unverified'
    end;

    -- Source hash for idempotent dedup on the question level
    v_source_hash := md5(
      v_autopsy_id::text || ':' ||
      coalesce(v_question_number::text, '') || ':' ||
      coalesce(v_question->>'questionText', '') || ':' ||
      coalesce(v_question->>'correctAnswer', '')
    );

    -- ─── Insert autopsy_questions row (upsert on conflict) ─────────────────
    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id',            p_trace_id,
        'status',              v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review',        v_needs_review,
        'source_autopsy_id',   v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
      set extraction_confidence = excluded.extraction_confidence,
          evidence_status       = excluded.evidence_status,
          updated_at            = now()
    returning id into v_question_id;

    -- ─── Insert into mistakes table for pending_review AND verified_mistake ──
    -- IMPORTANT: pending_review items ARE stored (for future manual review),
    -- but the event payload only includes verified_mistake items in wrongQuestions.
    -- Downstream consumers (AtlasConsumer, MemoryConsumer, CommandConsumer) use
    -- isVerifiedAutopsyMistake() to gate their operations.
    if v_evidence_status in ('pending_review', 'verified_mistake') then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown'),
        v_evidence_status,   -- status on mistakes table mirrors evidence_status
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number)
        where source_autopsy_id is not null and source_question_number is not null
      do nothing;   -- idempotent: retry does not duplicate mistakes

      -- Only include verified_mistake items in the event payload.
      -- pending_review items sit in the DB waiting for manual confirmation.
      if v_evidence_status = 'verified_mistake' then
        v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
          'questionNumber',      v_question_number,
          'subject',             v_question->>'subject',
          'chapter',             v_question->>'chapter',
          'mistakeCategory',     v_question->>'mistakeCategory',
          'reasoning',           v_question->>'reasoning',
          'correctExplanation',  v_question->>'correctExplanation',
          'conceptualGap',       v_question->>'conceptualGap',
          'status',              v_evidence_status,
          -- Both snake_case and camelCase to satisfy isVerifiedAutopsyMistake()
          'evidence_status',     v_evidence_status,
          'evidenceStatus',      v_evidence_status,
          'extraction_confidence', v_confidence,
          'extractionConfidence',  v_confidence,
          'needs_review',        false,
          'needsReview',         false,
          'source_question_id',  v_question_id,
          'sourceQuestionId',    v_question_id,
          'source_autopsy_id',   v_autopsy_id,
          'sourceAutopsyId',     v_autopsy_id,
          'trace_id',            p_trace_id
        ));
      end if;
    end if;
  end loop;

  -- ─── STEP 4: Publish AUTOPSY_MOCK_PROCESSED event transactionally ────────
  -- The event payload includes summary counts and wrongQuestions (verified only).
  -- Downstream consumers use wrongQuestions to decide what to update.
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId',        v_autopsy_id,
      'testName',         p_test_name,
      'examType',         p_exam_type,
      'rawScore',         v_computed_score,
      'recoverableScore', v_computed_score + v_computed_recoverable,
      'potentialScore',   v_computed_potential,
      'totalQuestions',   jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount',     v_computed_correct_count,
      'incorrectCount',   v_computed_incorrect_count,
      'verifiedCount',    jsonb_array_length(v_wrong_questions),
      'pendingReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'pending_review'
      ),
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source',          'autopsy_engine',
      'autopsyId',       v_autopsy_id,
      'trace_id',        p_trace_id,
      -- Only verified mistakes flow downstream to mutate learner state
      'wrongQuestions',  v_wrong_questions
    )
  );

  -- ─── STEP 5: Mark autopsy as completed ───────────────────────────────────
  update public.mock_autopsies
  set status       = 'completed',
      completed_at = now(),
      metadata     = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  -- Invalidate today's and tomorrow's session cards (stale after new autopsy)
  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  -- Bump learner state version so caches know state changed
  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at            = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id',        v_autopsy_id,
    'event_id',          v_event_id,
    'idempotent_replay', false,
    'verified_count',    jsonb_array_length(v_wrong_questions),
    'pending_review_count', (
      select count(*) from public.autopsy_questions
      where autopsy_id = v_autopsy_id and evidence_status = 'pending_review'
    )
  );

exception when others then
  -- On any failure, mark the autopsy row as failed so it doesn't appear
  -- as stuck in 'processing'. Do NOT mutate ATLAS or MEMORY on failure.
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status        = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
-- Ensure only the backend service role can call this function
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, authenticated;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to service_role;
-- ─── Schema hardening: ensure updated_at column exists on autopsy_questions ─
-- (needed for the ON CONFLICT ... do update clause above)
alter table public.autopsy_questions
  add column if not exists updated_at timestamptz default now();
-- Ensure columns exist before creating indexes
alter table public.mock_autopsies
  add column if not exists idempotency_key text,
  add column if not exists trace_id uuid;
-- Ensure the unique index for idempotency on mock_autopsies exists
create unique index if not exists idx_mock_autopsies_idempotency_key
  on public.mock_autopsies(idempotency_key)
  where idempotency_key is not null;
-- Ensure the ON CONFLICT target index exists on autopsy_questions
create unique index if not exists idx_autopsy_questions_autopsy_qnum
  on public.autopsy_questions(autopsy_id, question_number);
-- Ensure the ON CONFLICT target partial unique index exists on mistakes
create unique index if not exists idx_mistakes_dedup_source
  on public.mistakes(user_id, source_autopsy_id, source_question_number)
  where source_autopsy_id is not null and source_question_number is not null;
-- Ensure evidence_status column exists with correct values
alter table public.mistakes
  add column if not exists extraction_confidence numeric;
-- Index to efficiently find pending_review items for the future review queue
create index if not exists idx_mistakes_pending_review
  on public.mistakes(user_id, status)
  where status = 'pending_review';
create index if not exists idx_autopsy_questions_evidence_status
  on public.autopsy_questions(autopsy_id, evidence_status);
-- Migration: 20260531000002_session_card_rpc_auth.sql
-- Purpose: Lock down authenticated-callable session-card SECURITY DEFINER RPCs.

create or replace function public.complete_daily_session_card(
  p_user_id uuid,
  p_date date default current_date
) returns jsonb as $$
declare
  v_updated int;
  v_version int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  update public.session_cards
  set
    "isCompleted" = true,
    "completedAt" = now(),
    is_completed = true,
    completed_at = now()
  where user_id = p_user_id
    and date = p_date
    and ("isCompleted" = false or "isCompleted" is null);

  get diagnostics v_updated = row_count;

  update public.profiles
  set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    updated_at = now()
  where id = p_user_id
  returning learner_state_version into v_version;

  return jsonb_build_object(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date
  );
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.complete_daily_session_card(uuid, date) from public;
grant execute on function public.complete_daily_session_card(uuid, date) to authenticated;
create or replace function public.invalidate_session_card(
  p_user_id uuid,
  p_reason text default 'manual_invalidation'
) returns jsonb as $$
declare
  v_version int;
  v_deleted int := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'unauthorized';
    end if;
  end if;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  get diagnostics v_deleted = row_count;

  update public.profiles
  set
    learner_state_version = coalesce(learner_state_version, 0) + 1,
    updated_at = now()
  where id = p_user_id
  returning learner_state_version into v_version;

  return jsonb_build_object(
    'deleted', v_deleted,
    'newVersion', v_version,
    'reason', p_reason
  );
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.invalidate_session_card(uuid, text) from public;
grant execute on function public.invalidate_session_card(uuid, text) to authenticated;
-- Migration: 20260531000003_missing_tables_aliases.sql
-- Purpose: Provide semantic_memories and mistake_events for schema validation

create or replace view public.semantic_memories as
select * from public.chat_memory;
create or replace view public.mistake_events as
select * from public.mistakes;
-- Migration: 20260531000004_fix_smoke_issues.sql
-- Purpose: Fix issues found during MVP smoke testing

-- 1. Add missing emotional_state column to chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS emotional_state TEXT;
-- 2. Fix the default value of exam_type to comply with the check constraint
ALTER TABLE public.profiles
  ALTER COLUMN exam_type SET DEFAULT 'neet';
-- Ensure any existing uppercase 'NEET' is fixed so check constraints pass
UPDATE public.profiles
  SET exam_type = 'neet'
  WHERE exam_type = 'NEET';
-- Migration: 20260531000005_fix_smoke_issues_2.sql
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS intent TEXT;
-- Migration: 20260531000006_mvp_runtime_closure.sql
-- Purpose: close the production MVP runtime gaps left after disabling non-MVP
-- features: authenticated AUTOPSY ingest, worker status summaries, and small
-- support tables referenced by active MVP paths.

-- Event parent status can now summarize mixed consumer outcomes.
do $$
begin
  alter type public.event_status add value if not exists 'PARTIAL_FAILED';
exception
  when duplicate_object then null;
end $$;
-- Runtime support table for deterministic session-close UX.
create table if not exists public.session_closing_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.study_sessions(id) on delete set null,
  message text not null,
  type text not null default 'success',
  created_at timestamptz not null default now()
);
alter table public.session_closing_messages enable row level security;
drop policy if exists "Users access own session_closing_messages" on public.session_closing_messages;
create policy "Users access own session_closing_messages"
  on public.session_closing_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Service role manages session_closing_messages" on public.session_closing_messages;
create policy "Service role manages session_closing_messages"
  on public.session_closing_messages for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
create index if not exists idx_session_closing_messages_user
  on public.session_closing_messages(user_id, created_at desc);
-- Legacy mastery service support tables. Active ATLAS paths primarily update
-- concepts/mastery_events, but these tables keep older service paths valid.
create table if not exists public.concept_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  mastery_score numeric not null default 0,
  confidence numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, concept_id)
);
alter table public.concept_mastery enable row level security;
drop policy if exists "Users access own concept_mastery" on public.concept_mastery;
create policy "Users access own concept_mastery"
  on public.concept_mastery for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Service role manages concept_mastery" on public.concept_mastery;
create policy "Service role manages concept_mastery"
  on public.concept_mastery for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
create table if not exists public.mastery_evidence_log (
  id uuid primary key default gen_random_uuid(),
  mastery_id uuid not null references public.concept_mastery(id) on delete cascade,
  evidence_type text not null,
  strength numeric not null default 0,
  source_id text,
  created_at timestamptz not null default now()
);
alter table public.mastery_evidence_log enable row level security;
drop policy if exists "Users view own mastery_evidence_log" on public.mastery_evidence_log;
create policy "Users view own mastery_evidence_log"
  on public.mastery_evidence_log for select
  using (
    exists (
      select 1 from public.concept_mastery cm
      where cm.id = mastery_evidence_log.mastery_id
        and cm.user_id = auth.uid()
    )
  );
drop policy if exists "Users insert own mastery_evidence_log" on public.mastery_evidence_log;
create policy "Users insert own mastery_evidence_log"
  on public.mastery_evidence_log for insert
  with check (
    exists (
      select 1 from public.concept_mastery cm
      where cm.id = mastery_evidence_log.mastery_id
        and cm.user_id = auth.uid()
    )
  );
drop policy if exists "Service role manages mastery_evidence_log" on public.mastery_evidence_log;
create policy "Service role manages mastery_evidence_log"
  on public.mastery_evidence_log for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
create table if not exists public.mastery_confidence (
  id uuid primary key default gen_random_uuid(),
  mastery_id uuid not null references public.concept_mastery(id) on delete cascade,
  confidence numeric not null default 0,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.mastery_confidence enable row level security;
drop policy if exists "Users view own mastery_confidence" on public.mastery_confidence;
create policy "Users view own mastery_confidence"
  on public.mastery_confidence for select
  using (
    exists (
      select 1 from public.concept_mastery cm
      where cm.id = mastery_confidence.mastery_id
        and cm.user_id = auth.uid()
    )
  );
drop policy if exists "Users insert own mastery_confidence" on public.mastery_confidence;
create policy "Users insert own mastery_confidence"
  on public.mastery_confidence for insert
  with check (
    exists (
      select 1 from public.concept_mastery cm
      where cm.id = mastery_confidence.mastery_id
        and cm.user_id = auth.uid()
    )
  );
drop policy if exists "Service role manages mastery_confidence" on public.mastery_confidence;
create policy "Service role manages mastery_confidence"
  on public.mastery_confidence for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
create index if not exists idx_concept_mastery_user_concept
  on public.concept_mastery(user_id, concept_id);
create index if not exists idx_mastery_evidence_log_mastery
  on public.mastery_evidence_log(mastery_id, created_at desc);
create index if not exists idx_mastery_confidence_mastery
  on public.mastery_confidence(mastery_id, created_at desc);
-- Shared concept template cache. It is non-user data; authenticated users may
-- read cached templates, while backend service writes are unrestricted.
create table if not exists public.concept_templates (
  id uuid primary key default gen_random_uuid(),
  exam_type text not null,
  subject text not null,
  chapter text not null,
  concepts_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_type, subject, chapter)
);
alter table public.concept_templates enable row level security;
drop policy if exists "Authenticated users read concept_templates" on public.concept_templates;
create policy "Authenticated users read concept_templates"
  on public.concept_templates for select
  using (auth.role() = 'authenticated');
drop policy if exists "Service role manages concept_templates" on public.concept_templates;
create policy "Service role manages concept_templates"
  on public.concept_templates for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
-- Operational provider health is backend-only.
create table if not exists public.provider_health (
  provider text primary key,
  status text not null,
  last_checked timestamptz not null default now(),
  failure_reason text
);
alter table public.provider_health enable row level security;
drop policy if exists "Service role manages provider_health" on public.provider_health;
create policy "Service role manages provider_health"
  on public.provider_health for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
-- User-bound AUTOPSY RPC must be called with the authenticated request client.
-- The API route derives p_user_id from supabase.auth.getUser(); browser clients
-- cannot spoof another user because the RPC checks auth.uid() directly.
do $migration$
declare
  v_signature regprocedure := 'public.ingest_mock_autopsy(uuid,text,text,integer,integer,integer,integer,numeric,numeric,numeric,jsonb,text,uuid,numeric)'::regprocedure;
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef(v_signature) into v_definition;

  if v_definition ~ $pattern$auth\.uid\(\) is null or auth\.uid\(\) <> p_user_id$pattern$ then
    v_rewritten := v_definition;
  else
    v_rewritten := regexp_replace(
      v_definition,
      $pattern$-- SECURITY: Only service_role can call this \(prevents client-side score spoofing\)\s+if current_setting\('request\.jwt\.claim\.role', true\) <> 'service_role' then\s+raise exception 'unauthorized: mock autopsies must be processed via the backend AI engine';\s+end if;$pattern$,
      $replacement$if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;$replacement$,
      'm'
    );
  end if;

  if v_rewritten = v_definition and v_definition !~ $pattern$auth\.uid\(\) is null or auth\.uid\(\) <> p_user_id$pattern$ then
    raise exception 'Could not rewrite ingest_mock_autopsy authorization block';
  end if;

  if v_rewritten <> v_definition then
    execute v_rewritten;
  end if;
end
$migration$;
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, authenticated, service_role;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated;
-- Document ingestion is outside the MVP. Keep the historical RPC name from
-- referencing a missing documents table, but fail closed if anything calls it.
create or replace function public.ingest_autopsy_document(
  p_user_id uuid,
  p_filename text,
  p_file_url text,
  p_file_type text,
  p_mime_type text,
  p_size_bytes bigint,
  p_metadata jsonb
) returns uuid as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  raise exception 'disabled_for_mvp';
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.ingest_autopsy_document(uuid, text, text, text, text, bigint, jsonb)
  from public, authenticated, service_role;
-- Worker/backlog indexes used by health checks and cron processing.
create index if not exists idx_event_queue_status_next_created
  on public.event_queue(status, next_attempt_at, created_at);
create index if not exists idx_event_queue_user_type_created
  on public.event_queue(user_id, type, created_at desc);
create index if not exists idx_consumer_locks_status_next
  on public.consumer_locks(status, next_attempt_at, next_retry_at, lease_expires_at);
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
-- Ensure already-deployed databases match the final MVP runtime contract.
-- Fresh databases also get these definitions from earlier migrations, but this
-- forward migration repairs environments that stopped before the runtime closure.

do $migration$
declare
  v_signature regprocedure := 'public.complete_study_session(uuid,text,text,text,text,integer,boolean,text,integer,text,uuid,uuid,text,text)'::regprocedure;
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef(v_signature) into v_definition;
  v_rewritten := replace(
    v_definition,
    '''COMMAND_SESSION_COMPLETED''',
    '''STUDY_SESSION_COMPLETED'''
  );

  if v_rewritten <> v_definition then
    execute v_rewritten;
  end if;
end
$migration$;
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, service_role;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated;
-- Close remaining executable MVP loop gaps:
-- - COMMAND is no longer an active event consumer.
-- - AUTOPSY uploads can be queued as durable jobs.
-- - ATLAS concepts and MEMORY cards get canonical dedupe keys.

create extension if not exists pgcrypto;
create extension if not exists unaccent;
do $$
begin
  alter type public.event_status add value if not exists 'PARTIAL_FAILED';
exception
  when undefined_object then null;
end $$;
create or replace function public.normalize_academic_text(p_value text)
returns text as $$
declare
  v text;
  word text;
  words text[] := array[]::text[];
begin
  if p_value is null then
    return null;
  end if;

  v := lower(unaccent(p_value));
  v := replace(v, '&', ' and ');
  v := regexp_replace(v, '[^a-z0-9]+', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));

  if v = '' then
    return null;
  end if;

  foreach word in array string_to_array(v, ' ')
  loop
    if word in ('and', 'the', 'of') then
      continue;
    end if;
    if length(word) > 4 and right(word, 3) = 'ies' then
      word := left(word, length(word) - 3) || 'y';
    elsif length(word) > 3 and right(word, 1) = 's' then
      word := left(word, length(word) - 1);
    end if;
    words := array_append(words, word);
  end loop;

  v := array_to_string(words, ' ');
  return nullif(v, '');
end;
$$ language plpgsql immutable set search_path = public;
create or replace function public.normalize_academic_chapter(p_value text)
returns text as $$
declare
  v text := public.normalize_academic_text(p_value);
begin
  if v in (
    'electrostatic',
    'electrostatics',
    'electric charge field',
    'electric charge fields',
    'electric charges field',
    'electric charges fields'
  ) then
    return 'electric charge field';
  end if;
  return v;
end;
$$ language plpgsql immutable set search_path = public;
create or replace function public.normalize_academic_subject(p_value text)
returns text as $$
declare
  raw text := lower(coalesce(p_value, ''));
  v text := public.normalize_academic_text(p_value);
begin
  if raw like '%physics%' then
    return 'physics';
  end if;
  if raw ~ 'mathematics|maths|math' then
    return 'mathematics';
  end if;
  return v;
end;
$$ language plpgsql immutable set search_path = public;
alter table public.concepts
  add column if not exists normalized_subject text,
  add column if not exists normalized_chapter text,
  add column if not exists normalized_name text,
  add column if not exists concept_key text;
update public.concepts
set
  normalized_subject = public.normalize_academic_subject(subject),
  normalized_chapter = public.normalize_academic_chapter(chapter),
  normalized_name = public.normalize_academic_text(coalesce(name, topic, chapter)),
  concept_key = concat_ws(
    '::',
    coalesce(public.normalize_academic_subject(subject), 'general'),
    coalesce(public.normalize_academic_chapter(chapter), 'general'),
    coalesce(public.normalize_academic_text(coalesce(name, topic, chapter)), public.normalize_academic_chapter(chapter), 'general')
  )
where concept_key is null
   or normalized_subject is null
   or normalized_chapter is null
   or normalized_name is null;
create or replace function public.set_concept_canonical_fields()
returns trigger as $$
begin
  new.normalized_subject := public.normalize_academic_subject(new.subject);
  new.normalized_chapter := public.normalize_academic_chapter(new.chapter);
  new.normalized_name := public.normalize_academic_text(coalesce(new.name, new.topic, new.chapter));
  new.concept_key := concat_ws(
    '::',
    coalesce(new.normalized_subject, 'general'),
    coalesce(new.normalized_chapter, 'general'),
    coalesce(new.normalized_name, new.normalized_chapter, 'general')
  );
  return new;
end;
$$ language plpgsql set search_path = public;
drop trigger if exists trg_set_concept_canonical_fields on public.concepts;
create trigger trg_set_concept_canonical_fields
before insert or update of subject, chapter, topic, name
on public.concepts
for each row execute function public.set_concept_canonical_fields();
do $$
begin
  create unique index if not exists idx_concepts_user_concept_key_unique
    on public.concepts(user_id, concept_key)
    where concept_key is not null;
exception
  when unique_violation then
    raise notice 'Skipping unique concept_key index until existing duplicate concepts are merged';
end $$;
alter table public.revision_cards
  add column if not exists normalized_key text;
update public.revision_cards
set normalized_key = encode(
  digest(
    coalesce(user_id::text, '') || chr(10) ||
    coalesce(concept_id::text, 'no-concept') || chr(10) ||
    coalesce(source_type, 'manual') || chr(10) ||
    coalesce(source_id, 'no-source') || chr(10) ||
    coalesce(public.normalize_academic_text(front), ''),
    'sha256'
  ),
  'hex'
)
where normalized_key is null;
do $$
begin
  create unique index if not exists idx_revision_cards_user_normalized_key_unique
    on public.revision_cards(user_id, normalized_key)
    where normalized_key is not null;
exception
  when unique_violation then
    raise notice 'Skipping unique revision card normalized_key index until existing duplicates are merged';
end $$;
create table if not exists public.autopsy_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'needs_user_input')),
  test_name text,
  exam_type text,
  payload jsonb not null default '{}'::jsonb,
  source text,
  idempotency_key text not null,
  retry_count integer not null default 0,
  result_autopsy_id uuid references public.mock_autopsies(id) on delete set null,
  error_message text,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
alter table public.autopsy_jobs enable row level security;
drop policy if exists "users_all_own_autopsy_jobs" on public.autopsy_jobs;
create policy "users_all_own_autopsy_jobs"
  on public.autopsy_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "service_role_all_autopsy_jobs" on public.autopsy_jobs;
create policy "service_role_all_autopsy_jobs"
  on public.autopsy_jobs for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');
create index if not exists idx_autopsy_jobs_status_created
  on public.autopsy_jobs(status, created_at);
create index if not exists idx_autopsy_jobs_user_created
  on public.autopsy_jobs(user_id, created_at desc);
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
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine']
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
delete from public.consumer_locks
where consumer_name = 'command_engine';
do $migration$
declare
  v_signature regprocedure := 'public.ingest_mock_autopsy(uuid,text,text,integer,integer,integer,integer,numeric,numeric,numeric,jsonb,text,uuid,numeric)'::regprocedure;
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef(v_signature) into v_definition;
  v_rewritten := regexp_replace(
    v_definition,
    $pattern$if auth\.uid\(\) is null or auth\.uid\(\) <> p_user_id then\s+raise exception 'unauthorized';\s+end if;$pattern$,
    $replacement$if current_setting('request.jwt.claim.role', true) <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'unauthorized';
  end if;$replacement$,
    'm'
  );

  if v_rewritten <> v_definition then
    execute v_rewritten;
  end if;
end
$migration$;
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated, service_role;
-- No-PULSE Cognition OS runtime hardening:
-- usage gates, deterministic semantic memory, episodic memory, and analytics baselines.

alter table public.ai_usage_daily
  add column if not exists chat_messages int not null default 0,
  add column if not exists tutor_messages int not null default 0,
  add column if not exists autopsy_uploads int not null default 0,
  add column if not exists ai_calls int not null default 0;
create or replace function public.check_and_increment_usage_gate(
  p_user_id uuid,
  p_gate text,
  p_limit int,
  p_amount int default 1
) returns jsonb as $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_amount int := greatest(1, coalesce(p_amount, 1));
  v_used int;
begin
  if p_gate not in ('chat_messages', 'tutor_messages', 'autopsy_uploads', 'ai_calls') then
    raise exception 'UNKNOWN_USAGE_GATE:%', p_gate;
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  v_used := case p_gate
    when 'chat_messages' then coalesce(v_usage.chat_messages, 0)
    when 'tutor_messages' then coalesce(v_usage.tutor_messages, 0)
    when 'autopsy_uploads' then coalesce(v_usage.autopsy_uploads, 0)
    when 'ai_calls' then coalesce(v_usage.ai_calls, 0)
  end;

  if v_used + v_amount > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'remaining', greatest(0, p_limit - v_used),
      'limit', p_limit
    );
  end if;

  update public.ai_usage_daily
  set
    chat_messages = case when p_gate = 'chat_messages' then chat_messages + v_amount else chat_messages end,
    tutor_messages = case when p_gate = 'tutor_messages' then tutor_messages + v_amount else tutor_messages end,
    autopsy_uploads = case when p_gate = 'autopsy_uploads' then autopsy_uploads + v_amount else autopsy_uploads end,
    ai_calls = case when p_gate = 'ai_calls' then ai_calls + v_amount else ai_calls end,
    updated_at = now()
  where id = v_usage.id;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + v_amount,
    'remaining', greatest(0, p_limit - v_used - v_amount),
    'limit', p_limit
  );
end;
$$ language plpgsql security definer set search_path = public;
revoke execute on function public.check_and_increment_usage_gate(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.check_and_increment_usage_gate(uuid, text, int, int) to service_role;
alter table public.chat_memory
  add column if not exists source_type text not null default 'global_chat',
  add column if not exists source_id text,
  add column if not exists role text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists idx_chat_memory_source_dedupe
  on public.chat_memory(user_id, source_type, source_id, role)
  where source_id is not null;
create index if not exists idx_chat_memory_source_lookup
  on public.chat_memory(user_id, source_type, created_at desc);
drop function if exists public.match_chat_memory(vector, float, int, uuid);
drop function if exists public.match_chat_memory(vector(768), float, int, uuid);
create or replace function public.match_chat_memory(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
) returns table (
  id uuid,
  content text,
  similarity float,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    cm.id,
    cm.content,
    1 - (cm.embedding <=> query_embedding) as similarity,
    cm.created_at
  from public.chat_memory cm
  where cm.user_id = p_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) > match_threshold
  order by
    (1 - (cm.embedding <=> query_embedding)) desc,
    coalesce(cm.importance_score, 0) desc,
    cm.created_at desc
  limit match_count;
$$;
revoke execute on function public.match_chat_memory(vector(768), float, int, uuid) from public, anon;
grant execute on function public.match_chat_memory(vector(768), float, int, uuid) to authenticated, service_role;
create table if not exists public.episodic_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null,
  source_type text not null,
  source_id text,
  importance_score numeric(4,2) not null default 0,
  emotional_salience numeric(4,2) not null default 0,
  retrieval_weight numeric(6,3) not null default 0,
  last_referenced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.episodic_memories
  add column if not exists summary text not null default '',
  add column if not exists source_type text not null default 'system',
  add column if not exists source_id text,
  add column if not exists importance_score numeric(4,2) not null default 0,
  add column if not exists emotional_salience numeric(4,2) not null default 0,
  add column if not exists retrieval_weight numeric(6,3) not null default 0,
  add column if not exists last_referenced_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.episodic_memories enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'episodic_memories'
      and policyname = 'Users access own episodic_memories'
  ) then
    create policy "Users access own episodic_memories"
      on public.episodic_memories for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
create unique index if not exists idx_episodic_memory_source_dedupe
  on public.episodic_memories(user_id, source_type, source_id)
  where source_id is not null;
create index if not exists idx_episodic_memory_retrieval
  on public.episodic_memories(user_id, retrieval_weight desc, created_at desc);
alter table public.chat_messages
  add column if not exists prompt_version text;
alter table public.ai_usage_events
  add column if not exists prompt_version text;
create table if not exists public.outcome_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  mock_score numeric,
  subject_scores jsonb not null default '{}'::jsonb,
  recoverable_marks numeric,
  mastery_percent numeric,
  revision_consistency numeric,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, snapshot_date)
);
create table if not exists public.feature_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  chat_sessions int not null default 0,
  autopsy_uploads int not null default 0,
  revision_cards_reviewed int not null default 0,
  study_sessions_completed int not null default 0,
  tutor_turns int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, usage_date)
);
alter table public.outcome_snapshots enable row level security;
alter table public.feature_usage_daily enable row level security;
do $$
declare
  t text;
begin
  foreach t in array array['outcome_snapshots', 'feature_usage_daily'] loop
    execute format('drop policy if exists "Users access own %I" on public.%I', t, t);
    execute format(
      'create policy "Users access own %I" on public.%I for select using (auth.uid() = user_id)',
      t,
      t
    );
  end loop;
end $$;
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
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
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
-- Add archived_at to chat_sessions to support archiving threads
alter table if exists public.chat_sessions
  add column if not exists archived_at timestamptz;
-- Ensure RLS allows the user to update their own sessions (if not already handled)
drop policy if exists "users_can_update_own_chat_sessions" on public.chat_sessions;
create policy "users_can_update_own_chat_sessions" on public.chat_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Add missing fields to session_cards for MVP hardening

alter table if exists public.session_cards
  add column if not exists "dayNumber" integer not null default 1,
  add column if not exists "streakDays" integer not null default 0,
  add column if not exists "daysToExam" integer,
  add column if not exists "overdueCards" integer not null default 0,
  add column if not exists "masteryPercent" numeric not null default 0,
  add column if not exists "closingMessage" text,
  add column if not exists "selectionReason" text,
  add column if not exists "mistakeCount" integer not null default 0,
  add column if not exists "weakConceptCount" integer not null default 0,
  add column if not exists "hasActiveGoal" boolean not null default false;
-- 20260530000016_remove_command_engine_from_mvp_consumers.sql
-- Remove command_engine from new event consumer locks.
-- command_engine is removed from the MVP learning loop; existing locks are unaffected.

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
begin
  with inserted as (
    insert into public.event_queue (
      user_id,
      type,
      payload,
      idempotency_key,
      metadata,
      status,
      next_attempt_at
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
    unnest(array[
      'learning_state_engine',
      'atlas_engine',
      'memory_engine',
      'concept_expansion_engine',
      'chat_side_effect_engine'
    ]::text[]),
    'PENDING',
    now(),
    now()
  on conflict (event_id, consumer_name) do nothing;

  return v_event_id;
end;
$$ language plpgsql volatile security definer set search_path = public;
alter table public.mock_autopsies
  add column if not exists total_questions integer not null default 0,
  add column if not exists correct_count integer not null default 0,
  add column if not exists incorrect_count integer not null default 0,
  add column if not exists unattempted_count integer not null default 0,
  add column if not exists current_score numeric not null default 0,
  add column if not exists potential_score numeric not null default 0,
  add column if not exists recoverable_marks numeric not null default 0,
  add column if not exists status text not null default 'processing';
alter table public.mistakes
  add column if not exists autopsy_id uuid references public.mock_autopsies(id) on delete cascade,
  add column if not exists concept_id uuid references public.concepts(id) on delete set null,
  add column if not exists category text,
  add column if not exists status text,
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists topic text,
  add column if not exists question_text text,
  add column if not exists user_answer text,
  add column if not exists correct_answer text,
  add column if not exists marks_lost numeric,
  add column if not exists total_marks numeric,
  add column if not exists ai_analysis text,
  add column if not exists improvement_suggestion text,
  add column if not exists source_autopsy_id uuid references public.mock_autopsies(id) on delete cascade,
  add column if not exists source_question_number integer,
  add column if not exists extraction_confidence numeric;
-- Migration: 20260531000001_autopsy_verified_pipeline.sql
-- Purpose: Fix autopsy pipeline so high-confidence mistakes reach verified_mistake status
--          and mutate ATLAS + MEMORY via the event system. Low-confidence items stay
--          in pending_review and MUST NOT mutate learner state.
--
-- Root bug fixed: the previous implementation always assigned 'pending_review' to
-- incorrect questions, making the isVerifiedAutopsyMistake() guard block all
-- downstream consumers (AtlasConsumer, MemoryConsumer, CommandConsumer).
--
-- Three-tier evidence_status routing (unchanged from previous migration):
--   verified_mistake    → confidence >= threshold AND not flagged needsReview
--                         → allowed to update ATLAS mastery + create MEMORY cards
--   pending_review      → confidence < threshold OR flagged needsReview
--                         → stored for manual review, NO learner state mutations
--   needs_review        → explicit needsReview flag (usually OCR issues)
--                         → stored for manual review, NO learner state mutations
--
-- Idempotency: early-return on duplicate idempotency_key (e.g. client retry on timeout)
-- Deduplication: ON CONFLICT guards on autopsy_questions and mistakes tables

create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;

  -- Idempotency guard
  v_existing_autopsy_id uuid;
  v_existing_metadata jsonb;

  -- Secure server-side recompute variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  -- ─── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
  -- If this upload was already processed (e.g. client retry after timeout),
  -- return the original result without re-inserting or re-publishing.
  if p_idempotency_key is not null then
    select id, metadata into v_existing_autopsy_id, v_existing_metadata
    from public.mock_autopsies
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_autopsy_id is not null then
      return jsonb_build_object(
        'autopsy_id', v_existing_autopsy_id,
        'event_id',   coalesce(v_existing_metadata->>'event_id', null),
        'idempotent_replay', true
      );
    end if;
  end if;

  -- ─── STEP 1: Securely recompute aggregates from questions array ───────────
  -- We ignore client-provided counts/scores and derive them server-side.
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost  := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score     := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      -- Only recoverable categories contribute to recoverable marks
      if v_question->>'mistakeCategory' in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
        v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- ─── STEP 2: Insert mock_autopsies row ───────────────────────────────────
  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
    v_computed_correct_count,
    v_computed_incorrect_count,
    v_computed_unattempted_count,
    v_computed_score,
    v_computed_recoverable,
    v_computed_potential,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  -- ─── STEP 3: Process each question ───────────────────────────────────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce(
      nullif(v_question->>'questionNumber', '')::int,
      nullif(v_question->>'question_number', '')::int
    );
    v_status := coalesce(v_question->>'status', 'Unattempted');

    -- Resolve confidence: prefer extractionConfidence, fall back to ocrConfidence, default 100
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );

    -- needsReview flag wins over confidence calculation
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false)
                      or v_confidence < p_confidence_threshold;

    -- ─── THREE-TIER ROUTING ────────────────────────────────────────────────
    -- THIS IS THE CRITICAL FIX: previous code never assigned 'verified_mistake'
    -- because the CASE only checked needs_review or Incorrect — never both
    -- conditions together.
    --
    -- verified_mistake  → high-confidence incorrect answer → safe to update ATLAS/MEMORY
    -- pending_review    → low-confidence incorrect answer  → stored, no state mutations
    -- needs_review      → OCR/extraction flags raised      → stored, no state mutations
    -- ignored_or_unverified → correct/unattempted          → not stored in mistakes table
    v_evidence_status := case
      when v_needs_review                                                     then 'needs_review'
      when v_status = 'Incorrect' and v_confidence >= p_confidence_threshold  then 'verified_mistake'
      when v_status = 'Incorrect'                                              then 'pending_review'
      else                                                                          'ignored_or_unverified'
    end;

    -- Source hash for idempotent dedup on the question level
    v_source_hash := md5(
      v_autopsy_id::text || ':' ||
      coalesce(v_question_number::text, '') || ':' ||
      coalesce(v_question->>'questionText', '') || ':' ||
      coalesce(v_question->>'correctAnswer', '')
    );

    -- ─── Insert autopsy_questions row (upsert on conflict) ─────────────────
    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id',            p_trace_id,
        'status',              v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review',        v_needs_review,
        'source_autopsy_id',   v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
      set extraction_confidence = excluded.extraction_confidence,
          evidence_status       = excluded.evidence_status,
          updated_at            = now()
    returning id into v_question_id;

    -- ─── Insert into mistakes table for pending_review AND verified_mistake ──
    -- IMPORTANT: pending_review items ARE stored (for future manual review),
    -- but the event payload only includes verified_mistake items in wrongQuestions.
    -- Downstream consumers (AtlasConsumer, MemoryConsumer, CommandConsumer) use
    -- isVerifiedAutopsyMistake() to gate their operations.
    if v_evidence_status in ('pending_review', 'verified_mistake') then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown')::mistake_category,
        v_evidence_status,   -- status on mistakes table mirrors evidence_status
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number)
        where source_autopsy_id is not null and source_question_number is not null
      do nothing;   -- idempotent: retry does not duplicate mistakes

      -- Only include verified_mistake items in the event payload.
      -- pending_review items sit in the DB waiting for manual confirmation.
      if v_evidence_status = 'verified_mistake' then
        v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
          'questionNumber',      v_question_number,
          'subject',             v_question->>'subject',
          'chapter',             v_question->>'chapter',
          'mistakeCategory',     v_question->>'mistakeCategory',
          'reasoning',           v_question->>'reasoning',
          'correctExplanation',  v_question->>'correctExplanation',
          'conceptualGap',       v_question->>'conceptualGap',
          'status',              v_evidence_status,
          -- Both snake_case and camelCase to satisfy isVerifiedAutopsyMistake()
          'evidence_status',     v_evidence_status,
          'evidenceStatus',      v_evidence_status,
          'extraction_confidence', v_confidence,
          'extractionConfidence',  v_confidence,
          'needs_review',        false,
          'needsReview',         false,
          'source_question_id',  v_question_id,
          'sourceQuestionId',    v_question_id,
          'source_autopsy_id',   v_autopsy_id,
          'sourceAutopsyId',     v_autopsy_id,
          'trace_id',            p_trace_id
        ));
      end if;
    end if;
  end loop;

  -- ─── STEP 4: Publish AUTOPSY_MOCK_PROCESSED event transactionally ────────
  -- The event payload includes summary counts and wrongQuestions (verified only).
  -- Downstream consumers use wrongQuestions to decide what to update.
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId',        v_autopsy_id,
      'testName',         p_test_name,
      'examType',         p_exam_type,
      'rawScore',         v_computed_score,
      'recoverableScore', v_computed_score + v_computed_recoverable,
      'potentialScore',   v_computed_potential,
      'totalQuestions',   jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount',     v_computed_correct_count,
      'incorrectCount',   v_computed_incorrect_count,
      'verifiedCount',    jsonb_array_length(v_wrong_questions),
      'pendingReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'pending_review'
      ),
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source',          'autopsy_engine',
      'autopsyId',       v_autopsy_id,
      'trace_id',        p_trace_id,
      -- Only verified mistakes flow downstream to mutate learner state
      'wrongQuestions',  v_wrong_questions
    )
  );

  -- ─── STEP 5: Mark autopsy as completed ───────────────────────────────────
  update public.mock_autopsies
  set status       = 'completed',
      completed_at = now(),
      metadata     = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  -- Invalidate today's and tomorrow's session cards (stale after new autopsy)
  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  -- Bump learner state version so caches know state changed
  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at            = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id',        v_autopsy_id,
    'event_id',          v_event_id,
    'idempotent_replay', false,
    'verified_count',    jsonb_array_length(v_wrong_questions),
    'pending_review_count', (
      select count(*) from public.autopsy_questions
      where autopsy_id = v_autopsy_id and evidence_status = 'pending_review'
    )
  );

exception when others then
  -- On any failure, mark the autopsy row as failed so it doesn't appear
  -- as stuck in 'processing'. Do NOT mutate ATLAS or MEMORY on failure.
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status        = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, authenticated, service_role;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated;
-- ─── Schema hardening: ensure updated_at column exists on autopsy_questions ─
-- (needed for the ON CONFLICT ... do update clause above)
alter table public.autopsy_questions
  add column if not exists updated_at timestamptz default now();
-- Ensure columns exist before creating indexes
alter table public.mock_autopsies
  add column if not exists idempotency_key text,
  add column if not exists trace_id uuid;
-- Ensure the unique index for idempotency on mock_autopsies exists
create unique index if not exists idx_mock_autopsies_idempotency_key
  on public.mock_autopsies(idempotency_key)
  where idempotency_key is not null;
-- Ensure the ON CONFLICT target index exists on autopsy_questions
create unique index if not exists idx_autopsy_questions_autopsy_qnum
  on public.autopsy_questions(autopsy_id, question_number);
-- Ensure the ON CONFLICT target partial unique index exists on mistakes
create unique index if not exists idx_mistakes_dedup_source
  on public.mistakes(user_id, source_autopsy_id, source_question_number)
  where source_autopsy_id is not null and source_question_number is not null;
-- Ensure evidence_status column exists with correct values
alter table public.mistakes
  add column if not exists extraction_confidence numeric;
-- Index to efficiently find pending_review items for the future review queue
create index if not exists idx_mistakes_pending_review
  on public.mistakes(user_id, status)
  where status = 'pending_review';
create index if not exists idx_autopsy_questions_evidence_status
  on public.autopsy_questions(autopsy_id, evidence_status);
alter type mistake_category add value if not exists 'calculation_error';
alter type mistake_category add value if not exists 'unknown';
-- Migration: 20260601000300_streak_rpc_fix.sql
-- Purpose: Update complete_study_session to calculate and return streak_days directly.

create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
  v_current_streak int;
  v_last_active_at timestamptz;
  v_new_streak int;
  v_streak_changed boolean := false;
  v_today date := current_date;
  v_last_active_date date;
begin
  -- Get current streak
  select streak_days, last_active_at into v_current_streak, v_last_active_at
  from public.profiles
  where id = p_user_id
  for update;
  
  v_current_streak := coalesce(v_current_streak, 0);
  v_last_active_date := v_last_active_at::date;
  
  if v_last_active_date = v_today then
    -- Already active today
    v_new_streak := greatest(v_current_streak, 1);
  elsif v_last_active_date = v_today - interval '1 day' then
    -- Active yesterday
    v_new_streak := v_current_streak + 1;
    v_streak_changed := true;
  else
    -- Gap or new
    v_new_streak := 1;
    v_streak_changed := true;
  end if;

  -- Update profile
  update public.profiles
  set streak_days = v_new_streak,
      last_active_at = now(),
      updated_at = now()
  where id = p_user_id;

  -- Insert study session
  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- Create event atomically
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'COMMAND_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'streak_days', v_new_streak,
    'streak_changed', v_streak_changed
  );
end;
$$ language plpgsql security definer set search_path = public;
-- supabase/migrations/20260601000700_practice_evidence_schema.sql

CREATE TABLE IF NOT EXISTS public.practice_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_session_id UUID NULL,
    message_id UUID NULL,
    topic TEXT NOT NULL,
    subject TEXT NULL,
    exam_type TEXT NULL,
    set_type TEXT NOT NULL CHECK (set_type IN ('mcq', 'flashcard')),
    source TEXT NOT NULL DEFAULT 'mind',
    created_at TIMESTAMPTZ DEFAULT now()
);
-- Index for looking up sets by message_id
CREATE INDEX IF NOT EXISTS idx_practice_sets_message_id ON public.practice_sets (message_id);
CREATE INDEX IF NOT EXISTS idx_practice_sets_user_id ON public.practice_sets (user_id);
CREATE TABLE IF NOT EXISTS public.practice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_set_id UUID NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id UUID NULL,
    concept_name TEXT NULL,
    question TEXT NOT NULL,
    options JSONB NULL,
    correct_answer TEXT NULL,
    explanation TEXT NULL,
    difficulty TEXT NULL,
    position INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_practice_items_set_id ON public.practice_items (practice_set_id);
CREATE INDEX IF NOT EXISTS idx_practice_items_user_id ON public.practice_items (user_id);
CREATE TABLE IF NOT EXISTS public.practice_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    practice_set_id UUID NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
    practice_item_id UUID NOT NULL REFERENCES public.practice_items(id) ON DELETE CASCADE,
    answer TEXT NULL,
    is_correct BOOLEAN NULL,
    confidence TEXT NULL CHECK (confidence IN ('easy', 'medium', 'hard', 'forgot', 'knew')),
    time_taken_seconds INT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_id ON public.practice_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_item_id ON public.practice_attempts (practice_item_id);
-- Enable RLS
ALTER TABLE public.practice_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;
-- Policies for practice_sets
CREATE POLICY "Users can manage their own practice sets"
ON public.practice_sets
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
-- Policies for practice_items
CREATE POLICY "Users can manage their own practice items"
ON public.practice_items
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
-- Policies for practice_attempts
CREATE POLICY "Users can manage their own practice attempts"
ON public.practice_attempts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
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
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'command_engine']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
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
-- Migration: 20260601082500_fix_streak_rpc_auth_and_version.sql
-- Purpose: Add security check and learner_state_version bump to complete_study_session.

create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
  v_current_streak int;
  v_last_active_at timestamptz;
  v_new_streak int;
  v_streak_changed boolean := false;
  v_today date := current_date;
  v_last_active_date date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- Get current streak
  select streak_days, last_active_at into v_current_streak, v_last_active_at
  from public.profiles
  where id = p_user_id
  for update;
  
  v_current_streak := coalesce(v_current_streak, 0);
  v_last_active_date := v_last_active_at::date;
  
  if v_last_active_date = v_today then
    -- Already active today
    v_new_streak := greatest(v_current_streak, 1);
  elsif v_last_active_date = v_today - interval '1 day' then
    -- Active yesterday
    v_new_streak := v_current_streak + 1;
    v_streak_changed := true;
  else
    -- Gap or new
    v_new_streak := 1;
    v_streak_changed := true;
  end if;

  -- Update profile
  update public.profiles
  set streak_days = v_new_streak,
      last_active_at = now(),
      updated_at = now(),
      learner_state_version = coalesce(learner_state_version, 0) + 1
  where id = p_user_id;

  -- Insert study session
  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- Create event atomically
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'COMMAND_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'streak_days', v_new_streak,
    'streak_changed', v_streak_changed
  );
end;
$$ language plpgsql security definer set search_path = public;
-- Migration: 20260601082500_fix_streak_rpc_auth_and_version.sql
-- Purpose: Add security check and learner_state_version bump to complete_study_session.

create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
  v_current_streak int;
  v_last_active_at timestamptz;
  v_new_streak int;
  v_streak_changed boolean := false;
  v_today date := current_date;
  v_last_active_date date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- Get current streak
  select streak_days, last_active_at into v_current_streak, v_last_active_at
  from public.profiles
  where id = p_user_id
  for update;
  
  v_current_streak := coalesce(v_current_streak, 0);
  v_last_active_date := v_last_active_at::date;
  
  if v_last_active_date = v_today then
    -- Already active today
    v_new_streak := greatest(v_current_streak, 1);
  elsif v_last_active_date = v_today - interval '1 day' then
    -- Active yesterday
    v_new_streak := v_current_streak + 1;
    v_streak_changed := true;
  else
    -- Gap or new
    v_new_streak := 1;
    v_streak_changed := true;
  end if;

  -- Update profile
  update public.profiles
  set streak_days = v_new_streak,
      last_active_at = now(),
      updated_at = now(),
      learner_state_version = coalesce(learner_state_version, 0) + 1
  where id = p_user_id;

  -- Insert study session
  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- Create event atomically
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'STUDY_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'streak_days', v_new_streak,
    'streak_changed', v_streak_changed
  );
end;
$$ language plpgsql security definer set search_path = public;
-- 20260601082700_daily_microtasks.sql

CREATE TABLE IF NOT EXISTS public.daily_microtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_card_id UUID REFERENCES public.session_cards(id) ON DELETE SET NULL,
    task_date DATE NOT NULL,
    title TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    concept_id UUID REFERENCES public.concepts(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- concept, practice, revision, autopsy, mock, custom
    estimated_minutes INT NOT NULL DEFAULT 15,
    target_count INT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, done, skipped
    priority TEXT NOT NULL DEFAULT 'medium',
    source TEXT NOT NULL DEFAULT 'system', -- system, mind, user
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_microtasks_user_date ON public.daily_microtasks(user_id, task_date);
CREATE INDEX IF NOT EXISTS idx_daily_microtasks_session_card ON public.daily_microtasks(session_card_id);
-- Enable RLS
ALTER TABLE public.daily_microtasks ENABLE ROW LEVEL SECURITY;
-- RLS Policies
CREATE POLICY "Users can view their own microtasks"
    ON public.daily_microtasks FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own microtasks"
    ON public.daily_microtasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own microtasks"
    ON public.daily_microtasks FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own microtasks"
    ON public.daily_microtasks FOR DELETE
    USING (auth.uid() = user_id);
-- Source-grounded study material RAG for MIND.

create extension if not exists vector;
create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_filename text null,
  mime_type text not null,
  storage_path text null,
  source_type text not null default 'upload'
    check (source_type in ('upload', 'ncert', 'notes', 'coaching', 'pyq', 'solution', 'other')),
  exam_type text null,
  subject text null,
  chapter text null,
  topic text null,
  language text not null default 'en',
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed', 'archived')),
  page_count int null,
  char_count int null,
  content_hash text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.study_material_chunks (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  page_start int null,
  page_end int null,
  heading text null,
  text text not null,
  token_estimate int null,
  content_hash text null,
  embedding vector(768) null,
  embedding_provider text null,
  embedding_model text null,
  fts_vector tsvector generated always as (to_tsvector('english', coalesce(text, ''))) stored,
  created_at timestamptz not null default now()
);
create table if not exists public.rag_query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  material_ids uuid[] null,
  retrieved_chunk_ids uuid[] null,
  answer_message_id uuid null,
  total_chunks int,
  total_context_chars int,
  grounded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_study_materials_user on public.study_materials(user_id);
create index if not exists idx_study_materials_user_status on public.study_materials(user_id, status);
create index if not exists idx_study_materials_subject_chapter on public.study_materials(user_id, subject, chapter);
create unique index if not exists idx_study_materials_user_content_hash_unique
  on public.study_materials(user_id, content_hash)
  where content_hash is not null and status <> 'archived';
create index if not exists idx_study_material_chunks_user_material on public.study_material_chunks(user_id, material_id);
create index if not exists idx_study_material_chunks_material_index on public.study_material_chunks(material_id, chunk_index);
create unique index if not exists idx_study_material_chunks_material_hash_unique
  on public.study_material_chunks(material_id, content_hash)
  where content_hash is not null;
create index if not exists idx_study_material_chunks_fts on public.study_material_chunks using gin(fts_vector);
create index if not exists idx_study_material_chunks_embedding_hnsw
  on public.study_material_chunks using hnsw (embedding vector_cosine_ops)
  where embedding is not null;
alter table public.study_materials enable row level security;
alter table public.study_material_chunks enable row level security;
alter table public.rag_query_logs enable row level security;
drop policy if exists "study_materials_select_own" on public.study_materials;
create policy "study_materials_select_own"
on public.study_materials for select
using (auth.uid() = user_id);
drop policy if exists "study_materials_insert_own" on public.study_materials;
create policy "study_materials_insert_own"
on public.study_materials for insert
with check (auth.uid() = user_id);
drop policy if exists "study_materials_update_own" on public.study_materials;
create policy "study_materials_update_own"
on public.study_materials for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
drop policy if exists "study_materials_delete_own" on public.study_materials;
create policy "study_materials_delete_own"
on public.study_materials for delete
using (auth.uid() = user_id);
drop policy if exists "study_material_chunks_select_own" on public.study_material_chunks;
create policy "study_material_chunks_select_own"
on public.study_material_chunks for select
using (auth.uid() = user_id);
drop policy if exists "rag_query_logs_select_own" on public.rag_query_logs;
create policy "rag_query_logs_select_own"
on public.rag_query_logs for select
using (auth.uid() = user_id);
drop policy if exists "rag_query_logs_insert_own" on public.rag_query_logs;
create policy "rag_query_logs_insert_own"
on public.rag_query_logs for insert
with check (auth.uid() = user_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-materials',
  'study-materials',
  false,
  20971520,
  array['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown', 'application/markdown']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "study_material_storage_select_own" on storage.objects;
create policy "study_material_storage_select_own"
on storage.objects for select
using (
  bucket_id = 'study-materials'
  and auth.uid()::text = split_part(name, '/', 1)
);
drop policy if exists "study_material_storage_insert_own" on storage.objects;
create policy "study_material_storage_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'study-materials'
  and auth.uid()::text = split_part(name, '/', 1)
);
drop policy if exists "study_material_storage_delete_own" on storage.objects;
create policy "study_material_storage_delete_own"
on storage.objects for delete
using (
  bucket_id = 'study-materials'
  and auth.uid()::text = split_part(name, '/', 1)
);
alter table public.practice_items
  add column if not exists subject text null,
  add column if not exists chapter text null,
  add column if not exists topic text null,
  add column if not exists source_material_id uuid null references public.study_materials(id) on delete set null,
  add column if not exists source_chunk_ids uuid[] null;
alter table public.practice_attempts drop constraint if exists practice_attempts_confidence_check;
alter table public.practice_attempts
  add constraint practice_attempts_confidence_check
  check (confidence in ('easy', 'medium', 'hard', 'forgot', 'again', 'knew') or confidence is null);
create index if not exists idx_practice_items_source_material on public.practice_items(source_material_id);
drop function if exists public.match_study_material_chunks(vector(768), uuid, int, uuid[], text, text, float);
create or replace function public.match_study_material_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count int default 5,
  material_filter uuid[] default null,
  subject_filter text default null,
  chapter_filter text default null,
  similarity_threshold float default 0.68
)
returns table (
  id uuid,
  material_id uuid,
  material_title text,
  source_type text,
  chunk_index int,
  page_start int,
  page_end int,
  heading text,
  text text,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (auth.uid() is null or auth.uid() <> match_user_id) then
    raise exception 'Unauthorized: user_id mismatch';
  end if;

  return query
  select
    smc.id,
    smc.material_id,
    sm.title as material_title,
    sm.source_type,
    smc.chunk_index,
    smc.page_start,
    smc.page_end,
    smc.heading,
    smc.text,
    (1 - (smc.embedding <=> query_embedding))::float as similarity
  from public.study_material_chunks smc
  join public.study_materials sm on sm.id = smc.material_id
  where smc.user_id = match_user_id
    and sm.user_id = match_user_id
    and sm.status = 'ready'
    and smc.embedding is not null
    and (material_filter is null or smc.material_id = any(material_filter))
    and (subject_filter is null or sm.subject ilike '%' || subject_filter || '%')
    and (chapter_filter is null or sm.chapter ilike '%' || chapter_filter || '%')
    and (1 - (smc.embedding <=> query_embedding)) >= similarity_threshold
  order by smc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 8);
end;
$$;
revoke execute on function public.match_study_material_chunks(vector(768), uuid, int, uuid[], text, text, float)
from public, anon;
grant execute on function public.match_study_material_chunks(vector(768), uuid, int, uuid[], text, text, float)
to authenticated, service_role;
-- Final RAG integration fixes for Cognition OS.
-- Fixes query log mode, source metadata return, and source-linked practice artifacts.

create extension if not exists vector;
alter table public.rag_query_logs
  add column if not exists mode text not null default 'implicit';
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rag_query_logs_mode_check'
  ) then
    alter table public.rag_query_logs
      add constraint rag_query_logs_mode_check
      check (mode in ('explicit', 'implicit', 'off'));
  end if;
end $$;
alter table public.practice_items
  add column if not exists subject text,
  add column if not exists chapter text,
  add column if not exists topic text,
  add column if not exists source_material_id uuid references public.study_materials(id) on delete set null,
  add column if not exists source_chunk_ids uuid[];
create index if not exists practice_items_source_material_idx
  on public.practice_items(source_material_id);
create index if not exists rag_query_logs_mode_idx
  on public.rag_query_logs(user_id, mode, created_at desc);
drop function if exists public.match_study_material_chunks(
  vector(768),
  uuid,
  integer,
  uuid[],
  text,
  text,
  double precision
);
create or replace function public.match_study_material_chunks(
  query_embedding vector(768),
  match_user_id uuid,
  match_count integer default 5,
  material_filter uuid[] default null,
  subject_filter text default null,
  chapter_filter text default null,
  similarity_threshold double precision default 0.15
)
returns table (
  id uuid,
  material_id uuid,
  user_id uuid,
  chunk_index integer,
  page_start integer,
  page_end integer,
  heading text,
  text text,
  similarity double precision,
  material_title text,
  source_type text,
  subject text,
  chapter text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.material_id,
    c.user_id,
    c.chunk_index,
    c.page_start,
    c.page_end,
    c.heading,
    c.text,
    1 - (c.embedding <=> query_embedding) as similarity,
    m.title as material_title,
    m.source_type,
    m.subject,
    m.chapter
  from public.study_material_chunks c
  join public.study_materials m on m.id = c.material_id
  where c.user_id = match_user_id
    and m.user_id = match_user_id
    and m.status = 'ready'
    and c.embedding is not null
    and (material_filter is null or c.material_id = any(material_filter))
    and (subject_filter is null or lower(coalesce(m.subject, '')) = lower(subject_filter))
    and (chapter_filter is null or lower(coalesce(m.chapter, '')) = lower(chapter_filter))
    and (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 8));
$$;
grant execute on function public.match_study_material_chunks(
  vector(768), uuid, integer, uuid[], text, text, double precision
) to authenticated, service_role;
-- ============================================================================
-- AUTOPSY HARDENING: Evidence Contract & Mistake Tracking
-- ============================================================================

-- Add missing columns to autopsy_questions safely
alter table public.autopsy_questions
  add column if not exists evidence_status text default 'pending_review',
  add column if not exists mistake_type text,
  add column if not exists confidence numeric default 0 check (confidence >= 0 and confidence <= 1),
  add column if not exists concept_id uuid references public.concepts(id) on delete set null,
  add column if not exists concept_name text,
  add column if not exists student_answer text,
  add column if not exists correct_answer text,
  add column if not exists explanation text,
  add column if not exists evidence_source text default 'autopsy',
  add column if not exists raw_evidence jsonb default '{}'::jsonb,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
-- Add constraints to autopsy_questions (using DO block to catch if already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'autopsy_questions_evidence_status_check'
  ) then
    alter table public.autopsy_questions add constraint autopsy_questions_evidence_status_check 
      check (evidence_status in ('verified_mistake', 'verified_correct', 'needs_review', 'pending_review', 'ignored', 'corrected_by_user', 'ignored_or_unverified'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'autopsy_questions_mistake_type_check'
  ) then
    alter table public.autopsy_questions add constraint autopsy_questions_mistake_type_check 
      check (mistake_type in ('conceptual_gap', 'formula_recall', 'calculation_error', 'misread_question', 'option_trap', 'silly_mistake', 'time_pressure', 'forgot_fact', 'application_failure', 'low_confidence_guess', 'unattempted', 'ambiguous', 'out_of_syllabus', 'unknown'));
  end if;
end $$;
-- Indexes for autopsy_questions
create index if not exists idx_autopsy_questions_user_evidence_status on public.autopsy_questions(user_id, evidence_status);
create index if not exists idx_autopsy_questions_user_concept_id on public.autopsy_questions(user_id, concept_id);
-- Add missing columns to mistakes safely
alter table public.mistakes
  add column if not exists autopsy_question_id uuid references public.autopsy_questions(id) on delete set null,
  add column if not exists mistake_type text,
  add column if not exists confidence numeric default 1 check (confidence >= 0 and confidence <= 1),
  add column if not exists evidence_source text default 'autopsy',
  add column if not exists source text default 'autopsy',
  add column if not exists raw_evidence jsonb default '{}'::jsonb;
-- Add constraints to mistakes (using DO block to catch if already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mistakes_mistake_type_check'
  ) then
    alter table public.mistakes add constraint mistakes_mistake_type_check 
      check (mistake_type in ('conceptual_gap', 'formula_recall', 'calculation_error', 'misread_question', 'option_trap', 'silly_mistake', 'time_pressure', 'forgot_fact', 'application_failure', 'low_confidence_guess', 'unattempted', 'ambiguous', 'out_of_syllabus', 'unknown'));
  end if;
end $$;
-- Indexes for mistakes
create index if not exists idx_mistakes_user_concept on public.mistakes(user_id, concept_id);
create index if not exists idx_mistakes_user_created_desc on public.mistakes(user_id, created_at desc);
-- RLS check
alter table public.autopsy_questions enable row level security;
alter table public.mistakes enable row level security;
-- ============================================================================
-- OVERRIDE INGEST MOCK AUTOPSY RPC
-- ============================================================================

create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_mistake_type text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;

  -- Idempotency guard
  v_existing_autopsy_id uuid;
  v_existing_metadata jsonb;

  -- Secure server-side recompute variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  -- ─── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
  if p_idempotency_key is not null then
    select id, metadata into v_existing_autopsy_id, v_existing_metadata
    from public.mock_autopsies
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_autopsy_id is not null then
      return jsonb_build_object(
        'autopsy_id', v_existing_autopsy_id,
        'event_id',   coalesce(v_existing_metadata->>'event_id', null),
        'idempotent_replay', true
      );
    end if;
  end if;

  -- ─── STEP 1: Securely recompute aggregates from questions array ───────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost  := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score     := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      if coalesce(v_question->>'mistakeType', v_question->>'mistakeCategory') in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
        v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- ─── STEP 2: Insert mock_autopsies row ───────────────────────────────────
  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
    v_computed_correct_count,
    v_computed_incorrect_count,
    v_computed_unattempted_count,
    v_computed_score,
    v_computed_recoverable,
    v_computed_potential,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  -- ─── STEP 3: Process each question ───────────────────────────────────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce(
      nullif(v_question->>'questionNumber', '')::int,
      nullif(v_question->>'question_number', '')::int
    );
    v_status := coalesce(v_question->>'status', 'Unattempted');

    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );

    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false)
                      or v_confidence < p_confidence_threshold;

    v_evidence_status := coalesce(v_question->>'evidenceStatus', v_question->>'evidence_status');
    if v_evidence_status is null then
      v_evidence_status := case
        when v_needs_review                                                     then 'needs_review'
        when v_status = 'Incorrect' and v_confidence >= p_confidence_threshold  then 'verified_mistake'
        when v_status = 'Incorrect'                                              then 'pending_review'
        else                                                                          'ignored_or_unverified'
      end;
    end if;

    v_mistake_type := coalesce(v_question->>'mistakeType', v_question->>'mistakeCategory');
    if v_mistake_type not in ('conceptual_gap', 'formula_recall', 'calculation_error', 'misread_question', 'option_trap', 'silly_mistake', 'time_pressure', 'forgot_fact', 'application_failure', 'low_confidence_guess', 'unattempted', 'ambiguous', 'out_of_syllabus', 'unknown') then
      v_mistake_type := 'unknown';
    end if;

    v_source_hash := md5(
      v_autopsy_id::text || ':' ||
      coalesce(v_question_number::text, '') || ':' ||
      coalesce(v_question->>'questionText', '') || ':' ||
      coalesce(v_question->>'correctAnswer', '')
    );

    -- ─── Insert autopsy_questions row (upsert on conflict) ─────────────────
    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      mistake_type,
      concept_name,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      confidence,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_mistake_type,
      v_mistake_type,
      coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      greatest(0, least(1, v_confidence / 100)),
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id',            p_trace_id,
        'status',              v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review',        v_needs_review,
        'source_autopsy_id',   v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
      set extraction_confidence = excluded.extraction_confidence,
          evidence_status       = excluded.evidence_status,
          mistake_type          = excluded.mistake_type,
          concept_name          = excluded.concept_name,
          updated_at            = now()
    returning id into v_question_id;

    if v_evidence_status in ('pending_review', 'verified_mistake') then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        autopsy_question_id,
        concept_id,
        category,
        mistake_type,
        status,
        evidence_status,
        confidence,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        v_question_id,
        null,
        v_mistake_type::mistake_category,
        v_mistake_type,
        v_evidence_status,
        v_evidence_status,
        greatest(0, least(1, v_confidence / 100)),
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number)
        where source_autopsy_id is not null and source_question_number is not null
      do nothing;

      if v_evidence_status = 'verified_mistake' then
        v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
          'questionNumber',      v_question_number,
          'subject',             v_question->>'subject',
          'chapter',             v_question->>'chapter',
          'mistakeCategory',     v_mistake_type,
          'mistakeType',         v_mistake_type,
          'reasoning',           v_question->>'reasoning',
          'correctExplanation',  v_question->>'correctExplanation',
          'conceptualGap',       v_question->>'conceptualGap',
          'status',              v_evidence_status,
          'evidence_status',     v_evidence_status,
          'evidenceStatus',      v_evidence_status,
          'extraction_confidence', v_confidence,
          'extractionConfidence',  v_confidence,
          'needs_review',        false,
          'needsReview',         false,
          'source_question_id',  v_question_id,
          'sourceQuestionId',    v_question_id,
          'source_autopsy_id',   v_autopsy_id,
          'sourceAutopsyId',     v_autopsy_id,
          'trace_id',            p_trace_id
        ));
      end if;
    end if;
  end loop;

  -- ─── STEP 4: Publish AUTOPSY_MOCK_PROCESSED event transactionally ────────
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId',        v_autopsy_id,
      'testName',         p_test_name,
      'examType',         p_exam_type,
      'rawScore',         v_computed_score,
      'recoverableScore', v_computed_score + v_computed_recoverable,
      'potentialScore',   v_computed_potential,
      'totalQuestions',   jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount',     v_computed_correct_count,
      'incorrectCount',   v_computed_incorrect_count,
      'verifiedCount',    jsonb_array_length(v_wrong_questions),
      'pendingReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'pending_review'
      ),
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source',          'autopsy_engine',
      'autopsyId',       v_autopsy_id,
      'trace_id',        p_trace_id,
      'wrongQuestions',  v_wrong_questions
    )
  );

  -- ─── STEP 5: Mark autopsy as completed ───────────────────────────────────
  update public.mock_autopsies
  set status       = 'completed',
      completed_at = now(),
      metadata     = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at            = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id',        v_autopsy_id,
    'event_id',          v_event_id,
    'idempotent_replay', false,
    'verified_count',    jsonb_array_length(v_wrong_questions),
    'pending_review_count', (
      select count(*) from public.autopsy_questions
      where autopsy_id = v_autopsy_id and evidence_status = 'pending_review'
    )
  );

exception when others then
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status        = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, authenticated, service_role;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated;
-- Canonical bounded-agent infrastructure for Cognition OS.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_name text not null check (agent_name in ('mind', 'rag', 'atlas', 'memory', 'autopsy', 'planner', 'pulse', 'command', 'system')),
  trigger_type text not null check (trigger_type in ('event', 'request', 'worker', 'scheduled', 'manual', 'system')),
  trigger_event_id uuid null,
  trigger_source text null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz null,
  completed_at timestamptz null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error text null,
  error_code text null,
  attempt_count integer not null default 0,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_name, idempotency_key)
);
create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_name text not null check (agent_name in ('mind', 'rag', 'atlas', 'memory', 'autopsy', 'planner', 'pulse', 'command', 'system')),
  action_type text not null,
  target_type text null,
  target_id uuid null,
  status text not null check (status in ('proposed', 'pending_approval', 'approved', 'rejected', 'applied', 'skipped', 'failed')),
  risk_level text not null check (risk_level in ('safe_auto', 'auto_with_undo', 'requires_approval')),
  approval_status text not null default 'not_required' check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  confidence numeric null,
  evidence jsonb not null default '{}'::jsonb,
  reason text null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  applied_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error text null,
  error_code text null,
  unique(user_id, action_type, idempotency_key)
);
create table if not exists public.agent_action_approvals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.agent_actions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(action_id, user_id)
);
create table if not exists public.agent_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid null references public.agent_runs(id) on delete cascade,
  snapshot_type text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.mastery_evidence_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null,
  source_type text not null,
  source_id uuid null,
  source_event_id uuid null,
  agent_action_id uuid null references public.agent_actions(id),
  previous_mastery numeric null,
  delta numeric not null,
  new_mastery numeric not null,
  confidence numeric not null default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  reason text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, concept_id, source_type, idempotency_key)
);
create table if not exists public.rag_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  status text not null check (status in ('queued', 'extracting', 'chunking', 'embedding', 'completed', 'failed', 'cancelled')),
  attempt_count integer not null default 0,
  error text null,
  error_code text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, material_id, idempotency_key)
);
create table if not exists public.message_citations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null,
  material_id uuid null references public.study_materials(id) on delete set null,
  chunk_id uuid null references public.study_material_chunks(id) on delete set null,
  source_title text null,
  page_number integer null,
  section_title text null,
  quote text null,
  relevance_score numeric null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, message_id, chunk_id)
);
create table if not exists public.material_concept_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  chunk_id uuid null references public.study_material_chunks(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  confidence numeric not null default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  source text not null default 'rag_agent',
  created_at timestamptz not null default now()
);
create unique index if not exists idx_material_concept_links_chunk_null 
  on public.material_concept_links(user_id, material_id, concept_id) 
  where chunk_id is null;
create unique index if not exists idx_material_concept_links_chunk_not_null 
  on public.material_concept_links(user_id, material_id, chunk_id, concept_id) 
  where chunk_id is not null;
alter table public.study_material_chunks
  add column if not exists page_number integer null,
  add column if not exists section_title text null,
  add column if not exists content text null,
  add column if not exists char_count integer null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists idx_agent_runs_user on public.agent_runs(user_id);
create index if not exists idx_agent_runs_agent_name on public.agent_runs(agent_name);
create index if not exists idx_agent_runs_status on public.agent_runs(status);
create index if not exists idx_agent_runs_trigger_event_id on public.agent_runs(trigger_event_id);
create index if not exists idx_agent_runs_created_at on public.agent_runs(created_at desc);
create index if not exists idx_agent_actions_user on public.agent_actions(user_id);
create index if not exists idx_agent_actions_run on public.agent_actions(run_id);
create index if not exists idx_agent_actions_agent_name on public.agent_actions(agent_name);
create index if not exists idx_agent_actions_status on public.agent_actions(status);
create index if not exists idx_agent_actions_risk_level on public.agent_actions(risk_level);
create index if not exists idx_agent_actions_approval_status on public.agent_actions(approval_status);
create index if not exists idx_agent_actions_target on public.agent_actions(target_type, target_id);
create index if not exists idx_agent_actions_created_at on public.agent_actions(created_at desc);
create index if not exists idx_agent_action_approvals_user on public.agent_action_approvals(user_id);
create index if not exists idx_agent_action_approvals_action on public.agent_action_approvals(action_id);
create index if not exists idx_agent_action_approvals_decision on public.agent_action_approvals(decision);
create index if not exists idx_agent_action_approvals_decided_at on public.agent_action_approvals(decided_at desc);
create index if not exists idx_agent_state_snapshots_user on public.agent_state_snapshots(user_id);
create index if not exists idx_agent_state_snapshots_run on public.agent_state_snapshots(run_id);
create index if not exists idx_agent_state_snapshots_type on public.agent_state_snapshots(snapshot_type);
create index if not exists idx_agent_state_snapshots_created_at on public.agent_state_snapshots(created_at desc);
create index if not exists idx_mastery_evidence_ledger_user on public.mastery_evidence_ledger(user_id);
create index if not exists idx_mastery_evidence_ledger_concept on public.mastery_evidence_ledger(concept_id);
create index if not exists idx_mastery_evidence_ledger_source_type on public.mastery_evidence_ledger(source_type);
create index if not exists idx_mastery_evidence_ledger_source_event on public.mastery_evidence_ledger(source_event_id);
create index if not exists idx_mastery_evidence_ledger_created_at on public.mastery_evidence_ledger(created_at desc);
create index if not exists idx_rag_ingestion_jobs_user on public.rag_ingestion_jobs(user_id);
create index if not exists idx_rag_ingestion_jobs_material on public.rag_ingestion_jobs(material_id);
create index if not exists idx_rag_ingestion_jobs_status on public.rag_ingestion_jobs(status);
create index if not exists idx_rag_ingestion_jobs_created_at on public.rag_ingestion_jobs(created_at desc);
create index if not exists idx_message_citations_user on public.message_citations(user_id);
create index if not exists idx_message_citations_message on public.message_citations(message_id);
create index if not exists idx_message_citations_material on public.message_citations(material_id);
create index if not exists idx_message_citations_chunk on public.message_citations(chunk_id);
create unique index if not exists idx_message_citations_user_message_chunk_unique
  on public.message_citations(user_id, message_id, chunk_id);
create index if not exists idx_material_concept_links_user on public.material_concept_links(user_id);
create index if not exists idx_material_concept_links_material on public.material_concept_links(material_id);
create index if not exists idx_material_concept_links_chunk on public.material_concept_links(chunk_id);
create index if not exists idx_material_concept_links_concept on public.material_concept_links(concept_id);
alter table public.agent_runs enable row level security;
alter table public.agent_actions enable row level security;
alter table public.agent_action_approvals enable row level security;
alter table public.agent_state_snapshots enable row level security;
alter table public.mastery_evidence_ledger enable row level security;
alter table public.rag_ingestion_jobs enable row level security;
alter table public.message_citations enable row level security;
alter table public.material_concept_links enable row level security;
drop policy if exists "agent_runs_select_own" on public.agent_runs;
create policy "agent_runs_select_own" on public.agent_runs for select using (auth.uid() = user_id);
drop policy if exists "agent_actions_select_own" on public.agent_actions;
create policy "agent_actions_select_own" on public.agent_actions for select using (auth.uid() = user_id);
drop policy if exists "agent_action_approvals_select_own" on public.agent_action_approvals;
create policy "agent_action_approvals_select_own" on public.agent_action_approvals for select using (auth.uid() = user_id);
drop policy if exists "agent_action_approvals_insert_own_pending" on public.agent_action_approvals;
create policy "agent_action_approvals_insert_own_pending"
on public.agent_action_approvals for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.agent_actions aa
    where aa.id = action_id
      and aa.user_id = auth.uid()
      and aa.approval_status = 'pending'
  )
);
drop policy if exists "agent_state_snapshots_select_own" on public.agent_state_snapshots;
create policy "agent_state_snapshots_select_own" on public.agent_state_snapshots for select using (auth.uid() = user_id);
drop policy if exists "mastery_evidence_ledger_select_own" on public.mastery_evidence_ledger;
create policy "mastery_evidence_ledger_select_own" on public.mastery_evidence_ledger for select using (auth.uid() = user_id);
drop policy if exists "rag_ingestion_jobs_select_own" on public.rag_ingestion_jobs;
create policy "rag_ingestion_jobs_select_own" on public.rag_ingestion_jobs for select using (auth.uid() = user_id);
drop policy if exists "message_citations_select_own" on public.message_citations;
create policy "message_citations_select_own" on public.message_citations for select using (auth.uid() = user_id);
drop policy if exists "material_concept_links_select_own" on public.material_concept_links;
create policy "material_concept_links_select_own" on public.material_concept_links for select using (auth.uid() = user_id);
drop trigger if exists agent_runs_updated_at on public.agent_runs;
create trigger agent_runs_updated_at before update on public.agent_runs
  for each row execute function update_updated_at();
drop trigger if exists agent_actions_updated_at on public.agent_actions;
create trigger agent_actions_updated_at before update on public.agent_actions
  for each row execute function update_updated_at();
drop trigger if exists rag_ingestion_jobs_updated_at on public.rag_ingestion_jobs;
create trigger rag_ingestion_jobs_updated_at before update on public.rag_ingestion_jobs
  for each row execute function update_updated_at();
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
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'MATERIAL_UPLOADED' then array['rag_agent']
    when 'MATERIAL_INGESTION_REQUESTED' then array['rag_agent']
    when 'MATERIAL_INGESTED' then array['atlas_agent', 'memory_agent', 'planner_agent']
    when 'RAG_QUERY_USED' then array['mind_agent']
    when 'RAG_CARD_CANDIDATE_CREATED' then array['memory_agent']
    when 'MIND_ACTION_REQUESTED' then array['mind_agent']
    when 'MIND_CONTEXT_REFRESHED' then array['mind_agent']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'AUTOPSY_PROCESSING_COMPLETED' then array['autopsy_agent', 'planner_agent']
    when 'AUTOPSY_MISTAKE_EXTRACTED' then array['autopsy_agent']
    when 'AUTOPSY_MISTAKE_APPROVED' then array['atlas_agent', 'memory_agent', 'planner_agent']
    when 'AUTOPSY_MISTAKE_REJECTED' then array['autopsy_agent']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine']
    when 'REVISION_CARD_REVIEWED' then array['memory_agent', 'atlas_agent', 'planner_agent']
    when 'MEMORY_CARD_CREATE_REQUESTED' then array['memory_agent']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'ATLAS_MASTERY_UPDATE_REQUESTED' then array['atlas_agent']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'SESSION_CARD_COMPLETED' then array['atlas_agent', 'memory_agent', 'planner_agent']
    when 'SESSION_RECOMMENDATION_REQUESTED' then array['planner_agent']
    when 'SESSION_RECOMMENDATION_CREATED' then array['mind_agent']
    when 'LEARNER_STATE_CHANGED' then array['planner_agent', 'mind_agent']
    when 'PLANNER_REPLAN_REQUESTED' then array['planner_agent', 'command_agent']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'command_engine']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
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
-- Canonical no-PULSE, COMMAND-preserved event routing and agent runtime checks.
-- This is the forward source of truth for production databases after
-- 20260601170000_agentic_cognition_os.sql.

alter table if exists public.agent_runs
  drop constraint if exists agent_runs_agent_name_check;
update public.agent_runs
set agent_name = 'system'
where agent_name = 'pulse';
alter table if exists public.agent_runs
  add constraint agent_runs_agent_name_check
  check (agent_name in ('mind', 'rag', 'atlas', 'memory', 'autopsy', 'planner', 'command', 'system'));
alter table if exists public.agent_actions
  drop constraint if exists agent_actions_agent_name_check;
update public.agent_actions
set agent_name = 'system'
where agent_name = 'pulse';
alter table if exists public.agent_actions
  add constraint agent_actions_agent_name_check
  check (agent_name in ('mind', 'rag', 'atlas', 'memory', 'autopsy', 'planner', 'command', 'system'));
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
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'MATERIAL_UPLOADED' then array['rag_agent']
    when 'MATERIAL_INGESTION_REQUESTED' then array['rag_agent']
    when 'MATERIAL_INGESTED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'RAG_QUERY_USED' then array['mind_agent']
    when 'RAG_CARD_CANDIDATE_CREATED' then array['memory_agent']
    when 'MIND_ACTION_REQUESTED' then array['mind_agent']
    when 'MIND_CONTEXT_REFRESHED' then array['mind_agent']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'AUTOPSY_PROCESSING_COMPLETED' then array['autopsy_agent', 'planner_agent']
    when 'AUTOPSY_MISTAKE_EXTRACTED' then array['autopsy_agent']
    when 'AUTOPSY_MISTAKE_APPROVED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_REJECTED' then array['autopsy_agent']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent']
    when 'REVISION_CARD_REVIEWED' then array['memory_agent', 'atlas_agent', 'planner_agent']
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
-- Migration to add observability indexes to the event queue
CREATE INDEX IF NOT EXISTS idx_event_queue_status_created ON public.event_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_event_queue_user_id ON public.event_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_type ON public.event_queue(type);
-- consumer_locks already has an index for leasing (status, next_retry_at, lease_expires_at)
-- but we also need one on event_id for joining
CREATE INDEX IF NOT EXISTS idx_consumer_locks_event_id ON public.consumer_locks(event_id);
-- Fix missing columns in event_dlq that worker.ts expects
ALTER TABLE public.event_dlq
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS event_type text,
ADD COLUMN IF NOT EXISTS event_metadata jsonb,
ADD COLUMN IF NOT EXISTS attempts int,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
-- Migration: 20260602000200_ai_rate_limit_hardening.sql
-- Purpose: Add hourly chat caps and expensive operations daily caps.

alter table public.ai_usage_daily
  add column if not exists chat_messages_hourly int not null default 0,
  add column if not exists last_chat_hour timestamptz not null default date_trunc('hour', now()),
  add column if not exists expensive_operations int not null default 0;
create or replace function public.check_and_increment_usage_gate(
  p_user_id uuid,
  p_gate text,
  p_limit int,
  p_amount int default 1
) returns jsonb as $$
declare
  v_usage public.ai_usage_daily%rowtype;
  v_amount int := greatest(1, coalesce(p_amount, 1));
  v_used int;
  v_current_hour timestamptz := date_trunc('hour', now());
begin
  if p_gate not in ('chat_messages', 'chat_messages_hourly', 'tutor_messages', 'autopsy_uploads', 'ai_calls', 'expensive_operations') then
    raise exception 'UNKNOWN_USAGE_GATE:%', p_gate;
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if p_gate = 'chat_messages_hourly' then
    if v_usage.last_chat_hour < v_current_hour then
      v_used := 0;
    else
      v_used := coalesce(v_usage.chat_messages_hourly, 0);
    end if;
  else
    v_used := case p_gate
      when 'chat_messages' then coalesce(v_usage.chat_messages, 0)
      when 'tutor_messages' then coalesce(v_usage.tutor_messages, 0)
      when 'autopsy_uploads' then coalesce(v_usage.autopsy_uploads, 0)
      when 'ai_calls' then coalesce(v_usage.ai_calls, 0)
      when 'expensive_operations' then coalesce(v_usage.expensive_operations, 0)
    end;
  end if;

  if v_used + v_amount > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'remaining', greatest(0, p_limit - v_used),
      'limit', p_limit
    );
  end if;

  if p_gate = 'chat_messages_hourly' then
    update public.ai_usage_daily
    set
      chat_messages_hourly = v_used + v_amount,
      last_chat_hour = v_current_hour,
      updated_at = now()
    where id = v_usage.id;
  else
    update public.ai_usage_daily
    set
      chat_messages = case when p_gate = 'chat_messages' then chat_messages + v_amount else chat_messages end,
      tutor_messages = case when p_gate = 'tutor_messages' then tutor_messages + v_amount else tutor_messages end,
      autopsy_uploads = case when p_gate = 'autopsy_uploads' then autopsy_uploads + v_amount else autopsy_uploads end,
      ai_calls = case when p_gate = 'ai_calls' then ai_calls + v_amount else ai_calls end,
      expensive_operations = case when p_gate = 'expensive_operations' then expensive_operations + v_amount else expensive_operations end,
      updated_at = now()
    where id = v_usage.id;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used + v_amount,
    'remaining', greatest(0, p_limit - v_used - v_amount),
    'limit', p_limit
  );
end;
$$ language plpgsql security definer set search_path = public;
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
alter table public.practice_attempts
  add column if not exists idempotency_key text;
create unique index if not exists practice_attempts_user_id_idempotency_key_idx
  on public.practice_attempts(user_id, idempotency_key)
  where idempotency_key is not null;
-- 20260602000500_beta_rls_and_soft_deletes.sql
-- Module 4 (Postgres Setup, RLS, Schema Guardrails)

-- Add deleted_at columns for soft-deletes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'deleted_at') THEN
        ALTER TABLE profiles ADD COLUMN deleted_at timestamp with time zone;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_materials' AND column_name = 'deleted_at') THEN
        ALTER TABLE study_materials ADD COLUMN deleted_at timestamp with time zone;
    END IF;
END $$;
-- Enforce strict RLS on profiles and study_materials
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;
-- Profile RLS
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = id);
-- Prevent hard deletes by users entirely
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
-- Study Materials RLS
DROP POLICY IF EXISTS "Users can read own study materials" ON study_materials;
CREATE POLICY "Users can read own study materials"
    ON study_materials FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Users can insert own study materials" ON study_materials;
CREATE POLICY "Users can insert own study materials"
    ON study_materials FOR INSERT
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own study materials" ON study_materials;
CREATE POLICY "Users can update own study materials"
    ON study_materials FOR UPDATE
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);
-- Soft delete for study materials instead of hard delete
DROP POLICY IF EXISTS "Users can delete own study materials" ON study_materials;
-- Trigger to prevent manual hard deletions of profiles (Guardrail)
CREATE OR REPLACE FUNCTION prevent_profile_hard_delete()
RETURNS trigger AS $$
BEGIN
    -- Allow hard deletes only if current user is superuser or postgres
    IF current_user IN ('postgres', 'supabase_admin') THEN
        RETURN OLD;
    END IF;
    
    RAISE EXCEPTION 'Hard deletion of profiles is prevented. Use soft delete by setting deleted_at.';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_profile_hard_delete ON profiles;
CREATE TRIGGER trg_prevent_profile_hard_delete
    BEFORE DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_profile_hard_delete();
-- Add RLS policies for inserting and updating rag_ingestion_jobs

drop policy if exists "rag_ingestion_jobs_insert_own" on public.rag_ingestion_jobs;
create policy "rag_ingestion_jobs_insert_own" 
on public.rag_ingestion_jobs 
for insert 
with check (auth.uid() = user_id);
drop policy if exists "rag_ingestion_jobs_update_own" on public.rag_ingestion_jobs;
create policy "rag_ingestion_jobs_update_own" 
on public.rag_ingestion_jobs 
for update 
using (auth.uid() = user_id) 
with check (auth.uid() = user_id);
-- supabase/migrations/20260603000100_ai_response_cache.sql

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key text UNIQUE NOT NULL,
  task text NOT NULL,
  model text,
  provider text,
  input_hash text NOT NULL,
  response_json jsonb,
  response_text text,
  token_estimate int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_response_cache_expires_idx ON ai_response_cache (expires_at);
CREATE INDEX IF NOT EXISTS ai_response_cache_task_hash_idx ON ai_response_cache (task, input_hash);
ALTER TABLE ai_response_cache ENABLE ROW LEVEL SECURITY;
-- Only readable/writable by service role / admin (enforced by lack of public policies);
-- supabase/migrations/20260603000200_chat_session_summaries_and_usage_enhancements.sql

-- Session summary memory
CREATE TABLE IF NOT EXISTS chat_session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  summary text NOT NULL,
  key_facts jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, session_id)
);
ALTER TABLE chat_session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their session summaries"
  ON chat_session_summaries FOR ALL USING (user_id = auth.uid());
-- Enrich ai_usage_events (additive, never destructive)
DO $$ 
BEGIN
  -- Add cache_hit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'cache_hit') THEN
    ALTER TABLE ai_usage_events ADD COLUMN cache_hit boolean DEFAULT false;
  END IF;

  -- Add rule_first_hit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'rule_first_hit') THEN
    ALTER TABLE ai_usage_events ADD COLUMN rule_first_hit boolean DEFAULT false;
  END IF;

  -- Add skipped_providers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'skipped_providers') THEN
    ALTER TABLE ai_usage_events ADD COLUMN skipped_providers jsonb DEFAULT '[]';
  END IF;

  -- Add cost_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'cost_mode') THEN
    ALTER TABLE ai_usage_events ADD COLUMN cost_mode text DEFAULT 'ultra_cheap';
  END IF;

  -- Add tokens_saved_estimate
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_usage_events' AND column_name = 'tokens_saved_estimate') THEN
    ALTER TABLE ai_usage_events ADD COLUMN tokens_saved_estimate int DEFAULT 0;
  END IF;
END $$;
-- Embedding deduplication
CREATE UNIQUE INDEX IF NOT EXISTS study_material_chunks_content_hash_embedding_idx
  ON study_material_chunks (user_id, content_hash, embedding_model)
  WHERE content_hash IS NOT NULL AND embedding_model IS NOT NULL;
-- Goal-scoped product context for Cognition OS.
-- Learning goals are the primary container; chat, sources, revision,
-- progress, mistakes, practice, and daily missions can all attach to a goal.

alter table if exists public.chat_sessions
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists is_primary_for_goal boolean not null default false;
alter table if exists public.chat_sessions
  drop constraint if exists chat_sessions_session_type_check;
update public.chat_sessions
set archived_at = coalesce(archived_at, now()),
    session_type = 'thread',
    is_global = false
where session_type = 'archived';
update public.chat_sessions
set session_type = 'thread'
where session_type not in ('global', 'thread', 'goal', 'quick', 'tutor', 'practice', 'onboarding');
alter table if exists public.chat_sessions
  add constraint chat_sessions_session_type_check
  check (session_type in ('global', 'thread', 'goal', 'quick', 'tutor', 'practice', 'onboarding'));
create index if not exists idx_chat_sessions_user_goal_updated
  on public.chat_sessions(user_id, goal_id, updated_at desc);
create unique index if not exists idx_chat_sessions_goal_primary
  on public.chat_sessions(user_id, goal_id)
  where is_primary_for_goal = true
    and goal_id is not null
    and archived_at is null;
create index if not exists idx_chat_sessions_user_archived_updated
  on public.chat_sessions(user_id, archived_at, updated_at desc);
alter table if exists public.learning_goals
  add column if not exists subject text,
  add column if not exists domain text,
  add column if not exists exam_type text,
  add column if not exists target_level text,
  add column if not exists description text,
  add column if not exists primary_chat_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists last_active_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists idx_learning_goals_user_status_last_active
  on public.learning_goals(user_id, status, last_active_at desc);
create index if not exists idx_learning_goals_primary_chat
  on public.learning_goals(primary_chat_session_id);
alter table if exists public.study_materials
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;
create index if not exists idx_study_materials_user_goal_status
  on public.study_materials(user_id, goal_id, status);
create index if not exists idx_study_materials_user_session
  on public.study_materials(user_id, chat_session_id);
alter table if exists public.revision_cards
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null,
  add column if not exists source_message_id uuid references public.chat_messages(id) on delete set null;
create index if not exists idx_revision_cards_user_goal_due
  on public.revision_cards(user_id, goal_id, due);
create index if not exists idx_revision_cards_user_session_due
  on public.revision_cards(user_id, chat_session_id, due);
alter table if exists public.concepts
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;
create index if not exists idx_concepts_user_goal_mastery
  on public.concepts(user_id, goal_id, mastery);
create index if not exists idx_concepts_user_goal_score
  on public.concepts(user_id, goal_id, mastery_score);
alter table if exists public.mistakes
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;
create index if not exists idx_mistakes_user_goal_created
  on public.mistakes(user_id, goal_id, created_at desc);
alter table if exists public.mock_autopsies
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;
create index if not exists idx_mock_autopsies_user_goal_created
  on public.mock_autopsies(user_id, goal_id, created_at desc);
alter table if exists public.autopsy_jobs
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;
create index if not exists idx_autopsy_jobs_user_goal_created
  on public.autopsy_jobs(user_id, goal_id, created_at desc);
alter table if exists public.autopsy_questions
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null,
  add column if not exists chat_session_id uuid references public.chat_sessions(id) on delete set null;
create index if not exists idx_autopsy_questions_user_goal_created
  on public.autopsy_questions(user_id, goal_id, created_at desc);
alter table if exists public.practice_sets
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;
create index if not exists idx_practice_sets_user_goal_created
  on public.practice_sets(user_id, goal_id, created_at desc);
alter table if exists public.session_cards
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;
create index if not exists idx_session_cards_user_goal_date
  on public.session_cards(user_id, goal_id, date desc);
create unique index if not exists idx_session_cards_user_date_goal_not_null
  on public.session_cards(user_id, date, goal_id)
  where goal_id is not null;
alter table if exists public.daily_microtasks
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;
create index if not exists idx_daily_microtasks_user_goal_date
  on public.daily_microtasks(user_id, goal_id, task_date);
alter table if exists public.daily_plans
  add column if not exists goal_id uuid references public.learning_goals(id) on delete set null;
create index if not exists idx_daily_plans_user_goal_date
  on public.daily_plans(user_id, goal_id, plan_date desc);
-- Add goal_id and chat_session_id to study_tasks
ALTER TABLE public.study_tasks
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL;
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_goal_date ON public.study_tasks (user_id, goal_id, scheduled_date);
-- Update task_type enum to allow specific types
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'revise';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'mock';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'autopsy_recovery';
-- session_cards goal-specific uniqueness
ALTER TABLE public.session_cards
  DROP CONSTRAINT IF EXISTS session_cards_user_id_date_key;
DROP INDEX IF EXISTS idx_session_cards_user_date;
CREATE UNIQUE INDEX IF NOT EXISTS session_cards_user_date_global_unique 
  ON public.session_cards (user_id, date) 
  WHERE goal_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_cards_user_date_goal_unique 
  ON public.session_cards (user_id, date, goal_id) 
  WHERE goal_id IS NOT NULL;
-- daily_plans goal-specific uniqueness
ALTER TABLE public.daily_plans
  DROP CONSTRAINT IF EXISTS daily_plans_user_id_plan_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_plans_user_date_global_unique 
  ON public.daily_plans (user_id, plan_date) 
  WHERE goal_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS daily_plans_user_date_goal_unique 
  ON public.daily_plans (user_id, plan_date, goal_id) 
  WHERE goal_id IS NOT NULL;
ALTER TABLE public.learning_goals
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS progress numeric default 0;
-- 20260604000002_add_missing_metadata_columns.sql

ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.daily_microtasks
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.learning_goals
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
-- 20260604000003_missing_indexes_1000_users.sql

-- Storage bucket for Autopsy Evidence
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autopsy-evidence',
  'autopsy-evidence',
  false,
  20971520, -- 20MB
  '{image/png,image/jpeg,image/webp,application/pdf,text/plain}'
)
on conflict (id) do update set
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- RLS for autopsy-evidence
create policy "Users can upload their own autopsy evidence"
  on storage.objects for insert
  with check (bucket_id = 'autopsy-evidence' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can read their own autopsy evidence"
  on storage.objects for select
  using (bucket_id = 'autopsy-evidence' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete their own autopsy evidence"
  on storage.objects for delete
  using (bucket_id = 'autopsy-evidence' and auth.uid()::text = (storage.foldername(name))[1]);
-- Missing Indexes for 1000 Users Scale
create index if not exists idx_event_queue_user_id on event_queue(user_id);
create index if not exists idx_event_queue_idempotency on event_queue(idempotency_key);
create index if not exists idx_autopsy_jobs_user_id on autopsy_jobs(user_id);
create index if not exists idx_autopsy_jobs_idempotency on autopsy_jobs(idempotency_key);
create index if not exists idx_chat_messages_user_id on chat_messages(user_id);
create index if not exists idx_chat_messages_idempotency on chat_messages(idempotency_key);
create index if not exists idx_session_cards_user_id on session_cards(user_id);
create index if not exists idx_mistakes_user_id on mistakes(user_id);
create index if not exists idx_revision_cards_user_id on revision_cards(user_id);
-- RLS for study_material_chunks
create policy "study_material_chunks_insert_own"
  on public.study_material_chunks for insert
  with check (auth.uid() = user_id);
create policy "study_material_chunks_update_own"
  on public.study_material_chunks for update
  using (auth.uid() = user_id);
create policy "study_material_chunks_delete_own"
  on public.study_material_chunks for delete
  using (auth.uid() = user_id);
-- Phase 11: Admin Telemetry
-- We need to define get_ai_usage_summary_v2 since it is called in app/api/admin/ai-telemetry/route.ts
-- Currently returning a dummy structure or querying actual ai_usage_daily if available

CREATE OR REPLACE FUNCTION public.get_ai_usage_summary_v2()
RETURNS TABLE (
  total_requests bigint,
  total_tokens bigint,
  cost_estimate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(request_count), 0)::bigint as total_requests,
    COALESCE(SUM(total_tokens_used), 0)::bigint as total_tokens,
    0::numeric as cost_estimate
  FROM ai_usage_daily;
END;
$$;
-- Phase 3: Database Hardening
-- Ensure goal-scoped resources cannot leak across users using a composite foreign key.

-- 1. Add a unique constraint on learning_goals to support the composite FK
ALTER TABLE public.learning_goals ADD CONSTRAINT learning_goals_id_user_id_key UNIQUE (id, user_id);
-- 2. Add composite foreign keys to all tables that have both goal_id and user_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'study_tasks',
      'session_cards',
      'daily_plans',
      'chat_sessions',
      'study_materials',
      'revision_cards',
      'concepts',
      'mistakes',
      'mock_autopsies',
      'autopsy_jobs',
      'autopsy_questions',
      'practice_sets',
      'daily_microtasks'
    ])
  LOOP
    -- Only add if the table actually exists (some might be from different phases)
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I_goal_user_fkey FOREIGN KEY (goal_id, user_id) REFERENCES public.learning_goals(id, user_id)',
        t, t
      );
    END IF;
  END LOOP;
END
$$;
-- Phase 3: Database Hardening
-- Ensure ALL user-owned tables have RLS and user_id owner checks.
-- We explicitly set the policy for tables that might have been missed in earlier canonicalization.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'study_materials',
      'study_material_chunks',
      'rag_ingestion_jobs',
      'message_citations',
      'mastery_evidence_ledger',
      'agent_runs',
      'agent_actions',
      'agent_action_approvals',
      'agent_state_snapshots',
      'daily_plans',
      'daily_microtasks',
      'study_tasks',
      'practice_sets',
      'practice_items',
      'practice_attempts'
    ])
  LOOP
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      
      -- Drop old policy if it exists to replace it with the canonical one
      EXECUTE format('DROP POLICY IF EXISTS "users_all_own_%s" ON public.%I', t, t);
      
      -- Create the canonical owner policy
      EXECUTE format(
        'CREATE POLICY "users_all_own_%s" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t, t
      );
      
      -- Create the service_role bypass policy
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%s" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "service_role_all_%s" ON public.%I FOR ALL USING (current_setting(''request.jwt.claim.role'', true) = ''service_role'') WITH CHECK (current_setting(''request.jwt.claim.role'', true) = ''service_role'')',
        t, t
      );
    END IF;
  END LOOP;
END
$$;
-- Harden Autopsy Jobs
-- Modifies the check constraint on status to include 'queued' and 'dead_letter'
-- Migrates existing 'pending' statuses to 'queued'

BEGIN;
-- Drop existing constraint
ALTER TABLE "public"."autopsy_jobs" DROP CONSTRAINT IF EXISTS "autopsy_jobs_status_check";
-- Add new constraint
ALTER TABLE "public"."autopsy_jobs" 
  ADD CONSTRAINT "autopsy_jobs_status_check" 
  CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'completed'::"text", 'needs_user_input'::"text", 'failed'::"text", 'dead_letter'::"text"])));
-- Migrate any existing pending jobs
UPDATE "public"."autopsy_jobs" 
SET "status" = 'queued' 
WHERE "status" = 'pending';
COMMIT;
-- Add goal_type to profiles and learning_goals for universal goal support
-- exam_type remains as a backward-compatibility column

-- 1. Add goal_type to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS goal_type text;
-- 2. Add goal_type to learning_goals
ALTER TABLE public.learning_goals
ADD COLUMN IF NOT EXISTS goal_type text;
-- 3. Backfill goal_type based on existing exam_type
UPDATE public.profiles
SET goal_type = exam_type
WHERE goal_type IS NULL AND exam_type IS NOT NULL;
UPDATE public.learning_goals
SET goal_type = exam_type
WHERE goal_type IS NULL AND exam_type IS NOT NULL;
-- Add preset_id to learning_goals for universal domain presets
ALTER TABLE public.learning_goals
ADD COLUMN IF NOT EXISTS preset_id text;
-- Backfill preset_id based on existing exam_type
UPDATE public.learning_goals
SET preset_id = CASE
  WHEN lower(exam_type) LIKE '%neet%' THEN 'neet_ug'
  WHEN lower(exam_type) LIKE '%jee%' THEN 'jee_main'
  ELSE 'competitive_exam_generic'
END
WHERE preset_id IS NULL AND exam_type IS NOT NULL;
-- Public launch hardening:
-- - minimal beta waitlist
-- - minimal admin beta observability tables
-- - launch-friendly material statuses
-- - event coalescing/cap helper indexes

create table if not exists public.beta_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  goal_type text,
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.beta_waitlist enable row level security;
drop policy if exists "service_role_all_beta_waitlist" on public.beta_waitlist;
create policy "service_role_all_beta_waitlist"
  on public.beta_waitlist
  for all
  to service_role
  using (true)
  with check (true);
create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  identifier text,
  bucket text not null,
  action text not null default 'limited',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.rate_limit_events enable row level security;
alter table public.upload_events enable row level security;
alter table public.admin_audit enable row level security;
drop policy if exists "service_role_all_rate_limit_events" on public.rate_limit_events;
create policy "service_role_all_rate_limit_events"
  on public.rate_limit_events
  for all
  to service_role
  using (true)
  with check (true);
drop policy if exists "service_role_all_upload_events" on public.upload_events;
create policy "service_role_all_upload_events"
  on public.upload_events
  for all
  to service_role
  using (true)
  with check (true);
drop policy if exists "service_role_all_admin_audit" on public.admin_audit;
create policy "service_role_all_admin_audit"
  on public.admin_audit
  for all
  to service_role
  using (true)
  with check (true);
alter table public.study_materials
  add column if not exists retryable boolean not null default false;
create index if not exists idx_event_queue_user_type_metadata_created
  on public.event_queue(user_id, type, created_at desc);
create index if not exists idx_beta_waitlist_status_created
  on public.beta_waitlist(status, created_at desc);
create index if not exists idx_rate_limit_events_bucket_created
  on public.rate_limit_events(bucket, created_at desc);
create index if not exists idx_upload_events_user_status_created
  on public.upload_events(user_id, status, created_at desc);
create index if not exists idx_admin_audit_action_created
  on public.admin_audit(action, created_at desc);
-- Autopsy V3: structured assessments, deterministic reports, Hermes learning memory,
-- and universal learning signals.

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  title text not null,
  assessment_type text not null check (assessment_type in (
    'mock_test', 'practice_test', 'worksheet', 'assignment', 'quiz', 'past_paper', 'custom'
  )),
  source text not null check (source in ('manual', 'pdf', 'csv', 'imported')),
  total_marks numeric null,
  scored_marks numeric null,
  duration_minutes integer null,
  taken_at timestamptz null,
  status text not null default 'draft' check (status in (
    'draft', 'extracting', 'needs_review', 'answers_pending', 'diagnosis_pending',
    'report_generating', 'report_ready', 'failed'
  )),
  extraction_status text null check (extraction_status in (
    'not_started', 'uploaded', 'extracting', 'needs_review', 'ready', 'failed', 'manual_entry_required'
  )),
  extraction_confidence numeric null check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_number integer not null,
  subject text null,
  topic text null,
  subtopic text null,
  question_text text null,
  options jsonb null,
  correct_answer text null,
  user_answer text null,
  status text not null default 'unknown' check (status in (
    'correct', 'incorrect', 'skipped', 'unattempted', 'unknown'
  )),
  marks_awarded numeric null,
  negative_marks numeric null,
  difficulty text null check (difficulty in ('easy', 'medium', 'hard', 'unknown')),
  source_page integer null,
  extraction_confidence numeric null check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  user_reviewed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, question_number)
);
create table if not exists public.mistake_diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid null references public.assessments(id) on delete cascade,
  question_id uuid null unique references public.assessment_questions(id) on delete cascade,
  manual_mistake_id uuid null,
  goal_id uuid null,
  subject text null,
  topic text null,
  mistake_type text not null default 'unknown' check (mistake_type in (
    'concept_gap', 'memory_gap', 'silly_error', 'calculation_error',
    'misread_question', 'time_pressure', 'poor_elimination', 'guessed',
    'weak_application', 'overthinking', 'lack_of_revision', 'unknown'
  )),
  user_reason text null,
  user_reason_category text null,
  ai_root_cause text null,
  final_root_cause text null,
  prevention_rule text null,
  fix_strategy text null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending_user_reason' check (status in (
    'pending_user_reason', 'analyzing', 'ready', 'fallback_used', 'failed'
  )),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.hermes_learning_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  memory_type text not null check (memory_type in (
    'mistake_pattern', 'weak_topic', 'behavior_pattern', 'prevention_rule',
    'recovery_progress', 'confusion_signal', 'self_reported_weakness',
    'time_pressure_pattern', 'confidence_mismatch'
  )),
  subject text null,
  topic text null,
  pattern text not null,
  evidence_count integer not null default 1,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  prevention_rule text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  next_reminder_condition text null,
  source_refs jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'resolved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.autopsy_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null unique references public.assessments(id) on delete cascade,
  goal_id uuid null,
  report_json jsonb not null default '{}'::jsonb,
  summary_text text null,
  recoverable_marks_estimate numeric null,
  top_patterns jsonb not null default '[]'::jsonb,
  top_topics jsonb not null default '[]'::jsonb,
  status text not null default 'generating' check (status in ('generating', 'ready', 'fallback_used', 'failed')),
  generated_by text not null default 'deterministic' check (generated_by in ('deterministic', 'ai', 'hermes', 'mixed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.learning_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null,
  signal_type text not null check (signal_type in (
    'assessment_result', 'question_mistake', 'manual_mistake', 'chat_confusion',
    'revision_review', 'practice_attempt', 'source_upload', 'self_reflection',
    'task_completion'
  )),
  source_type text not null,
  source_id uuid null,
  subject text null,
  topic text null,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '{}'::jsonb,
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists assessments_user_created_idx on public.assessments(user_id, created_at desc);
create index if not exists assessments_user_status_idx on public.assessments(user_id, status);
create index if not exists assessments_user_goal_idx on public.assessments(user_id, goal_id);
create index if not exists assessment_questions_user_assessment_idx on public.assessment_questions(user_id, assessment_id);
create index if not exists assessment_questions_user_status_idx on public.assessment_questions(user_id, status);
create index if not exists assessment_questions_user_topic_idx on public.assessment_questions(user_id, subject, topic);
create index if not exists mistake_diagnoses_user_assessment_idx on public.mistake_diagnoses(user_id, assessment_id);
create index if not exists mistake_diagnoses_user_type_idx on public.mistake_diagnoses(user_id, mistake_type);
create index if not exists mistake_diagnoses_user_topic_idx on public.mistake_diagnoses(user_id, subject, topic);
create index if not exists hermes_learning_memories_user_idx on public.hermes_learning_memories(user_id);
create index if not exists hermes_learning_memories_user_status_idx on public.hermes_learning_memories(user_id, status);
create index if not exists hermes_learning_memories_user_subject_idx on public.hermes_learning_memories(user_id, subject);
create index if not exists hermes_learning_memories_user_topic_idx on public.hermes_learning_memories(user_id, topic);
create index if not exists hermes_learning_memories_user_type_idx on public.hermes_learning_memories(user_id, memory_type);
create index if not exists hermes_learning_memories_user_severity_idx on public.hermes_learning_memories(user_id, severity);
create index if not exists hermes_learning_memories_user_last_seen_idx on public.hermes_learning_memories(user_id, last_seen_at desc);
create index if not exists autopsy_reports_user_created_idx on public.autopsy_reports(user_id, created_at desc);
create index if not exists autopsy_reports_user_assessment_idx on public.autopsy_reports(user_id, assessment_id);
create index if not exists learning_signals_user_created_idx on public.learning_signals(user_id, created_at desc);
create index if not exists learning_signals_user_type_idx on public.learning_signals(user_id, signal_type);
create index if not exists learning_signals_user_topic_idx on public.learning_signals(user_id, subject, topic);
drop trigger if exists assessments_updated_at on public.assessments;
create trigger assessments_updated_at before update on public.assessments
  for each row execute function public.update_updated_at();
drop trigger if exists assessment_questions_updated_at on public.assessment_questions;
create trigger assessment_questions_updated_at before update on public.assessment_questions
  for each row execute function public.update_updated_at();
drop trigger if exists mistake_diagnoses_updated_at on public.mistake_diagnoses;
create trigger mistake_diagnoses_updated_at before update on public.mistake_diagnoses
  for each row execute function public.update_updated_at();
drop trigger if exists hermes_learning_memories_updated_at on public.hermes_learning_memories;
create trigger hermes_learning_memories_updated_at before update on public.hermes_learning_memories
  for each row execute function public.update_updated_at();
drop trigger if exists autopsy_reports_updated_at on public.autopsy_reports;
create trigger autopsy_reports_updated_at before update on public.autopsy_reports
  for each row execute function public.update_updated_at();
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.mistake_diagnoses enable row level security;
alter table public.hermes_learning_memories enable row level security;
alter table public.autopsy_reports enable row level security;
alter table public.learning_signals enable row level security;
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assessments',
    'assessment_questions',
    'mistake_diagnoses',
    'hermes_learning_memories',
    'autopsy_reports',
    'learning_signals'
  ] loop
    execute format('drop policy if exists "%s_select_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)', table_name, table_name);
    execute format('drop policy if exists "%s_insert_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)', table_name, table_name);
    execute format('drop policy if exists "%s_update_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
    execute format('drop policy if exists "%s_delete_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)', table_name, table_name);
  end loop;
end $$;
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
    when 'AUTOPSY_V3_REASONS_COLLECTED' then array['autopsy_agent']
    when 'AUTOPSY_V3_REPORT_READY' then array['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent']
    when 'HERMES_MEMORY_UPDATED' then array['memory_agent', 'planner_agent']
    when 'LEARNING_SIGNAL_INGESTED' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
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
    when 'HERMES_MISTAKE_REVIEW_REQUESTED' then array['hermes_worker']
    when 'HERMES_SOURCE_PROCESS_REQUESTED' then array['hermes_worker']
    when 'HERMES_REVISION_QUALITY_REQUESTED' then array['hermes_worker']
    when 'HERMES_TRACE_REQUESTED' then array['hermes_worker']
    when 'HERMES_NEXT_ACTION_REQUESTED' then array['hermes_worker']
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
CREATE TABLE IF NOT EXISTS "public"."seeded_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "goal_id" "uuid" NOT NULL REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE,
    "subject" "text" NOT NULL,
    "chapter" "text" NOT NULL,
    "topic" "text" NOT NULL,
    "microtarget" "text" NOT NULL,
    "parent_topic_id" "uuid",
    "mastery_score" numeric DEFAULT 0,
    "confidence" "text" DEFAULT 'low'::text,
    "source" "text" DEFAULT 'seeded_template'::text,
    "template_key" "text",
    "status" "text" DEFAULT 'active'::text,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    PRIMARY KEY ("id")
);
-- Idempotency constraint
ALTER TABLE "public"."seeded_topics" 
    ADD CONSTRAINT "seeded_topics_user_goal_template_microtarget_key" 
    UNIQUE ("user_id", "goal_id", "template_key", "microtarget");
ALTER TABLE "public"."seeded_topics" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own seeded topics"
    ON "public"."seeded_topics" FOR INSERT
    WITH CHECK ("auth"."uid"() = "user_id");
CREATE POLICY "Users can view their own seeded topics"
    ON "public"."seeded_topics" FOR SELECT
    USING ("auth"."uid"() = "user_id");
CREATE POLICY "Users can update their own seeded topics"
    ON "public"."seeded_topics" FOR UPDATE
    USING ("auth"."uid"() = "user_id");
CREATE POLICY "Users can delete their own seeded topics"
    ON "public"."seeded_topics" FOR DELETE
    USING ("auth"."uid"() = "user_id");
CREATE INDEX "seeded_topics_user_id_idx" ON "public"."seeded_topics" ("user_id");
CREATE INDEX "seeded_topics_goal_id_idx" ON "public"."seeded_topics" ("goal_id");
UPDATE public.practice_items
SET concept_name = topic
WHERE concept_name IS NULL AND topic IS NOT NULL;
-- ============================================================================
-- Cognition OS — Global Topic Seeding
-- Creates durable topic/microtarget map for any user goal.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS public.seeded_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.learning_goals(id) ON DELETE CASCADE,
  subject text NOT NULL,
  chapter text NOT NULL,
  topic text NOT NULL,
  microtarget text NOT NULL,
  parent_topic_id uuid NULL REFERENCES public.seeded_topics(id) ON DELETE SET NULL,
  order_index integer DEFAULT 0,
  topic_slug text,
  microtarget_slug text,
  mastery_score numeric DEFAULT 0,
  confidence text DEFAULT 'low',
  source text DEFAULT 'seeded_template',
  template_key text NOT NULL DEFAULT 'custom_goal_seed',
  status text DEFAULT 'not_started',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.seeded_topics
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic_slug text,
  ADD COLUMN IF NOT EXISTS microtarget_slug text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
UPDATE public.seeded_topics
SET
  topic_slug = COALESCE(
    topic_slug,
    NULLIF(regexp_replace(lower(topic), '[^a-z0-9]+', '-', 'g'), '')
  ),
  microtarget_slug = COALESCE(
    microtarget_slug,
    NULLIF(regexp_replace(lower(microtarget), '[^a-z0-9]+', '-', 'g'), '')
  )
WHERE topic_slug IS NULL OR microtarget_slug IS NULL;
UPDATE public.seeded_topics
SET
  topic_slug = COALESCE(topic_slug, 'topic'),
  microtarget_slug = COALESCE(microtarget_slug, 'microtarget');
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, goal_id, template_key, topic_slug, microtarget_slug
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.seeded_topics
)
DELETE FROM public.seeded_topics st
USING ranked r
WHERE st.id = r.id AND r.rn > 1;
ALTER TABLE public.seeded_topics
  DROP CONSTRAINT IF EXISTS seeded_topics_user_goal_template_microtarget_key;
ALTER TABLE public.seeded_topics
  DROP CONSTRAINT IF EXISTS seeded_topics_goal_template_topic_microtarget_key;
ALTER TABLE public.seeded_topics
  ADD CONSTRAINT seeded_topics_goal_template_topic_microtarget_key
  UNIQUE (user_id, goal_id, template_key, topic_slug, microtarget_slug);
CREATE INDEX IF NOT EXISTS seeded_topics_user_id_idx
  ON public.seeded_topics(user_id);
CREATE INDEX IF NOT EXISTS seeded_topics_goal_id_idx
  ON public.seeded_topics(goal_id);
CREATE INDEX IF NOT EXISTS seeded_topics_goal_order_idx
  ON public.seeded_topics(user_id, goal_id, order_index);
CREATE INDEX IF NOT EXISTS seeded_topics_goal_status_idx
  ON public.seeded_topics(user_id, goal_id, status);
CREATE INDEX IF NOT EXISTS seeded_topics_template_key_idx
  ON public.seeded_topics(template_key);
ALTER TABLE public.seeded_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own seeded topics" ON public.seeded_topics;
DROP POLICY IF EXISTS "Users can view their own seeded topics" ON public.seeded_topics;
DROP POLICY IF EXISTS "Users can update their own seeded topics" ON public.seeded_topics;
DROP POLICY IF EXISTS "Users can delete their own seeded topics" ON public.seeded_topics;
CREATE POLICY "Users can insert their own seeded topics"
  ON public.seeded_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own seeded topics"
  ON public.seeded_topics FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own seeded topics"
  ON public.seeded_topics FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own seeded topics"
  ON public.seeded_topics FOR DELETE
  USING (auth.uid() = user_id);
-- Migration: fix_event_routing_matrix.sql
-- Removes stale command-engine and updates the routing matrix to only include active consumers.

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
    when 'AUTOPSY_V3_REASONS_COLLECTED' then array['autopsy_agent', 'hermes_worker', 'learning_state_engine']
    when 'AUTOPSY_V3_REPORT_READY' then array['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'hermes_worker']
    when 'HERMES_MEMORY_UPDATED' then array['memory_agent', 'planner_agent']
    when 'LEARNING_SIGNAL_INGESTED' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
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
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'PRACTICE_ATTEMPT_SUBMITTED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'ONBOARDING_QUIZ_COMPLETE' then array['learning_state_engine', 'planner_agent', 'command_agent']
    when 'HERMES_MISTAKE_REVIEW_REQUESTED' then array['hermes_worker']
    when 'HERMES_SOURCE_PROCESS_REQUESTED' then array['hermes_worker']
    when 'HERMES_REVISION_QUALITY_REQUESTED' then array['hermes_worker']
    when 'HERMES_TRACE_REQUESTED' then array['hermes_worker']
    when 'HERMES_NEXT_ACTION_REQUESTED' then array['hermes_worker']
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
-- Migration: assessment_extractions.sql
-- Creates the assessment_extractions table with RLS to store full extracted text securely.

create table if not exists public.assessment_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  file_hash text not null,
  raw_text text not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);
create index if not exists idx_assessment_extractions_user on public.assessment_extractions(user_id);
create index if not exists idx_assessment_extractions_hash on public.assessment_extractions(file_hash);
alter table public.assessment_extractions enable row level security;
create policy "Users can insert their own extractions"
  on public.assessment_extractions for insert
  with check (auth.uid() = user_id);
create policy "Users can view their own extractions"
  on public.assessment_extractions for select
  using (auth.uid() = user_id);
create table if not exists public.admin_audit_logs (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid not null references auth.users(id),
    action text not null,
    details jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now() not null
);
alter table public.admin_audit_logs enable row level security;
-- 20260605_final_public_launch_canonicalization.sql

-- 1. Patch learning_signals check constraint
ALTER TABLE public.learning_signals DROP CONSTRAINT IF EXISTS learning_signals_signal_type_check;
ALTER TABLE public.learning_signals ADD CONSTRAINT learning_signals_signal_type_check CHECK (signal_type IN (
  'assessment_result', 'question_mistake', 'manual_mistake', 'chat_confusion',
  'revision_review', 'practice_attempt', 'source_upload', 'self_reflection',
  'task_completion', 'autopsy_memory_created'
));

-- 2. Add and confirm indexes
CREATE INDEX IF NOT EXISTS event_queue_user_status_created_idx ON public.event_queue(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS event_queue_status_next_attempt_idx ON public.event_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS consumer_locks_status_next_attempt_idx ON public.consumer_locks(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS consumer_locks_event_consumer_idx ON public.consumer_locks(event_id, consumer_name);
CREATE INDEX IF NOT EXISTS autopsy_reports_user_assessment_idx ON public.autopsy_reports(user_id, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_questions_user_assessment_idx ON public.assessment_questions(user_id, assessment_id);
CREATE INDEX IF NOT EXISTS learning_signals_user_type_created_idx ON public.learning_signals(user_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS hermes_learning_memories_user_status_last_seen_idx ON public.hermes_learning_memories(user_id, status, last_seen_at DESC);

-- 3. Patch event routing RPC to match EVENT_CONSUMER_MATRIX exactly
CREATE OR REPLACE FUNCTION public.create_event_with_consumers(
  p_user_id uuid,
  p_type text,
  p_data jsonb,
  p_idempotency_key text,
  p_source text,
  p_metadata jsonb
) RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
  v_consumers text[];
BEGIN
  v_consumers := CASE p_type
    WHEN 'CHAT_MESSAGE_PROCESSED' THEN ARRAY['chat_side_effect_engine', 'mind_agent']
    WHEN 'CHAT_MESSAGE_CREATED' THEN ARRAY['chat_side_effect_engine', 'mind_agent']
    WHEN 'CHAT_LEARNING_SIGNAL' THEN ARRAY['learning_state_engine', 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent']
    WHEN 'CHAT_SESSION_SUMMARIZE' THEN ARRAY['chat_side_effect_engine']
    WHEN 'MATERIAL_UPLOADED' THEN ARRAY['rag_agent']
    WHEN 'MATERIAL_INGESTION_REQUESTED' THEN ARRAY['rag_agent']
    WHEN 'MATERIAL_INGESTED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'RAG_QUERY_USED' THEN ARRAY['mind_agent']
    WHEN 'RAG_CARD_CANDIDATE_CREATED' THEN ARRAY['memory_agent']
    WHEN 'MIND_ACTION_REQUESTED' THEN ARRAY['mind_agent']
    WHEN 'MIND_CONTEXT_REFRESHED' THEN ARRAY['mind_agent']
    WHEN 'AUTOPSY_UPLOAD_RECEIVED' THEN ARRAY['autopsy_engine']
    WHEN 'MOCK_TEST_UPLOADED' THEN ARRAY['autopsy_engine']
    WHEN 'AUTOPSY_PROCESSING_COMPLETED' THEN ARRAY['autopsy_agent', 'planner_agent']
    WHEN 'TEST_ANALYSIS_COMPLETED' THEN ARRAY['autopsy_agent', 'planner_agent', 'command_agent']
    WHEN 'AUTOPSY_MISTAKE_EXTRACTED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_MISTAKE_APPROVED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'AUTOPSY_MISTAKE_REJECTED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_MOCK_PROCESSED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'MOCK_TEST_ANALYZED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'AUTOPSY_V3_ASSESSMENT_CREATED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_V3_QUESTIONS_UPSERTED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_V3_REASONS_COLLECTED' THEN ARRAY['autopsy_agent', 'hermes_worker', 'learning_state_engine']
    WHEN 'AUTOPSY_V3_REPORT_READY' THEN ARRAY['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'hermes_worker']
    WHEN 'HERMES_MEMORY_UPDATED' THEN ARRAY['memory_agent', 'planner_agent']
    WHEN 'LEARNING_SIGNAL_INGESTED' THEN ARRAY['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'STUDY_SESSION_COMPLETED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'MIND_TUTOR_COMPLETED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'MEMORY_CARD_REVIEWED' THEN ARRAY['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent']
    WHEN 'REVISION_CARD_REVIEWED' THEN ARRAY['memory_agent', 'atlas_agent', 'planner_agent']
    WHEN 'REVISION_COMPLETED' THEN ARRAY['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent']
    WHEN 'MEMORY_CARD_CREATE_REQUESTED' THEN ARRAY['memory_agent']
    WHEN 'ATLAS_MASTERY_UPDATED' THEN ARRAY['learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'ATLAS_MASTERY_UPDATE_REQUESTED' THEN ARRAY['atlas_agent']
    WHEN 'MEMORY_CARD_CREATED' THEN ARRAY['learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'CONCEPT_DISCOVERED' THEN ARRAY['concept_expansion_engine']
    WHEN 'INGESTION_DOCUMENT_PROCESSED' THEN ARRAY['learning_state_engine']
    WHEN 'MIND_MESSAGE_CREATED' THEN ARRAY['learning_state_engine']
    WHEN 'SESSION_CARD_COMPLETED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'SESSION_RECOMMENDATION_REQUESTED' THEN ARRAY['planner_agent']
    WHEN 'SESSION_RECOMMENDATION_CREATED' THEN ARRAY['mind_agent']
    WHEN 'LEARNER_STATE_CHANGED' THEN ARRAY['planner_agent', 'mind_agent']
    WHEN 'PLANNER_REPLAN_REQUESTED' THEN ARRAY['planner_agent', 'command_agent']
    WHEN 'STUDENT_MODEL_SYNC_REQUESTED' THEN ARRAY['learning_state_engine']
    WHEN 'PRACTICE_ATTEMPT_RECORDED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'PRACTICE_ATTEMPT_SUBMITTED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'ONBOARDING_QUIZ_COMPLETE' THEN ARRAY['learning_state_engine', 'planner_agent', 'command_agent']
    WHEN 'HERMES_MISTAKE_REVIEW_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_SOURCE_PROCESS_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_REVISION_QUALITY_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_TRACE_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_NEXT_ACTION_REQUESTED' THEN ARRAY['hermes_worker']
    ELSE ARRAY[]::text[]
  END;

  IF p_user_id IS NULL OR array_length(v_consumers, 1) IS NULL THEN
    RAISE EXCEPTION 'unsupported_event_type';
  END IF;

  WITH inserted AS (
    INSERT INTO public.event_queue (
      user_id, type, payload, idempotency_key, metadata, status, next_attempt_at
    ) VALUES (
      p_user_id,
      p_type,
      COALESCE(p_data, '{}'::jsonb),
      p_idempotency_key,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('source', COALESCE(p_source, 'system')),
      'PENDING',
      now()
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  )
  SELECT id INTO v_event_id FROM inserted;

  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id
    FROM public.event_queue
    WHERE idempotency_key = p_idempotency_key;
    RETURN v_event_id;
  END IF;

  INSERT INTO public.consumer_locks (
    event_id,
    consumer_name,
    status,
    next_retry_at,
    next_attempt_at
  )
  SELECT
    v_event_id,
    unnest(v_consumers),
    'PENDING',
    now(),
    now()
  ON CONFLICT (event_id, consumer_name) DO NOTHING;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) TO service_role;
-- Migration: Universal Goal Resolution & Curriculum Storage
-- Adds domain fields to learning_goals and creates goal_curriculum_nodes table.

-- 1. Alter learning_goals table safely
ALTER TABLE "public"."learning_goals" 
ADD COLUMN IF NOT EXISTS "subject" text,
ADD COLUMN IF NOT EXISTS "domain" text,
ADD COLUMN IF NOT EXISTS "exam" text,
ADD COLUMN IF NOT EXISTS "grade" text,
ADD COLUMN IF NOT EXISTS "board" text,
ADD COLUMN IF NOT EXISTS "target_outcome" text,
ADD COLUMN IF NOT EXISTS "confidence" numeric,
ADD COLUMN IF NOT EXISTS "needs_clarification" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "clarification_question" text;
-- 2. Create goal_curriculum_nodes table
CREATE TABLE IF NOT EXISTS "public"."goal_curriculum_nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "subject" "text",
    "domain" "text",
    "unit" "text",
    "chapter" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "estimated_minutes" integer,
    "mastery_score" numeric DEFAULT 0,
    "status" "text" DEFAULT 'not_started'::text,
    "source" "text" NOT NULL CHECK (source IN ('template', 'ai_generated', 'fallback', 'manual')),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "goal_curriculum_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_curriculum_nodes_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."learning_goals"("id") ON DELETE CASCADE
);
-- 3. Setup Indexes
CREATE INDEX IF NOT EXISTS "idx_goal_curriculum_nodes_user_goal" ON "public"."goal_curriculum_nodes" USING btree ("user_id", "goal_id");
CREATE INDEX IF NOT EXISTS "idx_goal_curriculum_nodes_user_goal_order" ON "public"."goal_curriculum_nodes" USING btree ("user_id", "goal_id", "order_index");
CREATE INDEX IF NOT EXISTS "idx_goal_curriculum_nodes_user_goal_status" ON "public"."goal_curriculum_nodes" USING btree ("user_id", "goal_id", "status");
-- 4. Enable RLS
ALTER TABLE "public"."goal_curriculum_nodes" ENABLE ROW LEVEL SECURITY;
-- 5. Policies
CREATE POLICY "Users access own goal_curriculum_nodes" 
ON "public"."goal_curriculum_nodes" 
USING ("auth"."uid"() = "user_id") 
WITH CHECK ("auth"."uid"() = "user_id");
-- Allow service_role
CREATE POLICY "service_role_all_goal_curriculum_nodes" 
ON "public"."goal_curriculum_nodes" 
USING (current_setting('request.jwt.claim.role', true) = 'service_role') 
WITH CHECK (current_setting('request.jwt.claim.role', true) = 'service_role');
GRANT ALL ON TABLE "public"."goal_curriculum_nodes" TO "anon";
GRANT ALL ON TABLE "public"."goal_curriculum_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_curriculum_nodes" TO "service_role";
-- Manual beta access, finite feature usage, and beta observability.

alter table if exists public.profiles
  add column if not exists beta_access boolean not null default false,
  add column if not exists beta_access_until timestamptz null,
  add column if not exists manual_plan text not null default 'free',
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_reason text null,
  add column if not exists onboarded_for_beta boolean not null default false,
  add column if not exists beta_notes text null,
  add column if not exists internal_admin_notes text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
update public.profiles
set manual_plan = 'free'
where manual_plan is null or manual_plan not in ('free', 'founding', 'pro', 'admin');
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_manual_plan_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_manual_plan_check
      check (manual_plan in ('free', 'founding', 'pro', 'admin'));
  end if;
end $$;
create table if not exists public.feature_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  amount integer not null default 1 check (amount > 0),
  estimated_cost_usd numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'committed' check (status in ('reserved', 'committed', 'released')),
  idempotency_key text null,
  created_at timestamptz not null default now()
);
create unique index if not exists feature_usage_events_idempotency_key_idx
  on public.feature_usage_events(idempotency_key)
  where idempotency_key is not null;
create index if not exists feature_usage_events_user_feature_created_idx
  on public.feature_usage_events(user_id, feature, created_at desc);
create index if not exists feature_usage_events_created_idx
  on public.feature_usage_events(created_at desc);
create index if not exists feature_usage_events_status_idx
  on public.feature_usage_events(status);
create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  route text not null,
  feature text null,
  error_code text not null,
  message text not null,
  severity text not null default 'error' check (severity in ('info', 'warn', 'error', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  request_id text null,
  created_at timestamptz not null default now()
);
create index if not exists app_error_events_created_idx
  on public.app_error_events(created_at desc);
create index if not exists app_error_events_route_created_idx
  on public.app_error_events(route, created_at desc);
create index if not exists app_error_events_severity_created_idx
  on public.app_error_events(severity, created_at desc);
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_admin_created_idx
  on public.admin_audit_log(admin_user_id, created_at desc);
create index if not exists admin_audit_log_action_created_idx
  on public.admin_audit_log(action, created_at desc);
create index if not exists profiles_beta_access_idx
  on public.profiles(beta_access);
create index if not exists profiles_manual_plan_idx
  on public.profiles(manual_plan);
create index if not exists profiles_suspended_idx
  on public.profiles(suspended);
create index if not exists profiles_email_idx
  on public.profiles(email)
  where email is not null;
create index if not exists event_queue_status_created_beta_idx
  on public.event_queue(status, created_at desc);
create index if not exists event_queue_type_status_beta_idx
  on public.event_queue(type, status);
create index if not exists consumer_locks_lease_expires_beta_idx
  on public.consumer_locks(lease_expires_at)
  where lease_expires_at is not null;
create index if not exists event_dlq_created_beta_idx
  on public.event_dlq(created_at desc);
create index if not exists event_dlq_type_beta_idx
  on public.event_dlq(event_type);
alter table public.feature_usage_events enable row level security;
alter table public.app_error_events enable row level security;
alter table public.admin_audit_log enable row level security;
drop policy if exists "users_read_own_feature_usage_events" on public.feature_usage_events;
create policy "users_read_own_feature_usage_events"
  on public.feature_usage_events
  for select
  to authenticated
  using (auth.uid() = user_id);
drop policy if exists "users_insert_own_feature_usage_events" on public.feature_usage_events;
create policy "users_insert_own_feature_usage_events"
  on public.feature_usage_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "users_read_own_app_error_events" on public.app_error_events;
create policy "users_read_own_app_error_events"
  on public.app_error_events
  for select
  to authenticated
  using (auth.uid() = user_id);
revoke all on public.admin_audit_log from anon, authenticated;
-- Drop the exam_type check constraint from profiles to allow custom categories from the new onboarding flow
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_exam_type_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_exam_type_check;
  END IF;
END $$;
-- Drop the study_materials constraints to support custom states and types during beta testing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'study_materials_status_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_materials DROP CONSTRAINT study_materials_status_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'study_materials_source_type_check' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.study_materials DROP CONSTRAINT study_materials_source_type_check;
  END IF;
END $$;
-- Add new statuses to study_materials
alter table public.study_materials drop constraint if exists study_materials_status_check;
alter table public.study_materials
  add constraint study_materials_status_check
  check (status in ('uploaded', 'queued', 'processing', 'parsed', 'embedding', 'ready', 'failed', 'needs_user_action', 'archived'));
-- Add tracking columns
alter table public.study_materials
  add column if not exists queued_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists parsed_at timestamptz,
  add column if not exists embedding_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists parse_confidence numeric,
  add column if not exists chunk_count integer,
  add column if not exists embedding_count integer,
  add column if not exists next_retry_at timestamptz;
-- Add total_mistakes column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_mistakes integer DEFAULT 0;
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
    when 'AUTOPSY_V3_REPORT_READY' then array['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'amaura_autopsy_cascade', 'amaura_plan_adapter', 'amaura_progress_evaluator', 'amaura_next_action']
    when 'LEARNING_SIGNAL_INGESTED' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent', 'amaura_session_agent']
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
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine', 'amaura_forgetting_agent', 'amaura_stagnation_agent', 'amaura_pattern_memory']
    when 'FORGETTING_SCAN_REQUESTED' then array['amaura_forgetting_agent']
    when 'STAGNATION_SCAN_REQUESTED' then array['amaura_stagnation_agent']
    when 'PATTERN_MEMORY_SCAN_REQUESTED' then array['amaura_pattern_memory']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent', 'amaura_practice_agent']
    when 'PRACTICE_ATTEMPT_SUBMITTED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent', 'amaura_practice_agent']
    when 'AMAURA_GOAL_CREATED' then array['amaura_goal_decomposer', 'amaura_next_action']
    when 'AMAURA_GOAL_UPDATED' then array['amaura_progress_evaluator', 'amaura_next_action']
    when 'AMAURA_TASK_CREATED' then array['amaura_next_action']
    when 'AMAURA_TASK_COMPLETED' then array['amaura_progress_evaluator', 'amaura_plan_adapter', 'amaura_next_action']
    when 'AMAURA_TASK_SKIPPED' then array['amaura_progress_evaluator', 'amaura_plan_adapter', 'amaura_next_action']
    when 'AMAURA_OBSERVATION_RECORDED' then array['amaura_progress_evaluator', 'amaura_plan_adapter', 'amaura_next_action']
    when 'AMAURA_PLAN_ADAPTED' then array['amaura_next_action']
    when 'AMAURA_GOAL_PROGRESS_EVALUATED' then array['amaura_next_action']
    when 'MEMORY_REVIEW_COMPLETED' then array['amaura_progress_evaluator', 'amaura_next_action']
    when 'ATLAS_CONCEPT_UPDATED' then array['amaura_plan_adapter', 'amaura_progress_evaluator', 'amaura_next_action']
    when 'SESSION_CLOSED' then array['amaura_session_agent', 'amaura_progress_evaluator', 'amaura_next_action']
    when 'DAILY_AGENT_TICK' then array['amaura_forgetting_agent', 'amaura_stagnation_agent', 'amaura_pattern_memory', 'amaura_progress_evaluator', 'amaura_next_action']
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
-- 20260607010000_mvp_agentic_idempotency_and_signals.sql
-- Tighten MIND/practice writeback idempotency for the MVP agentic loop.

alter table public.learning_signals
  add column if not exists idempotency_key text;

create unique index if not exists learning_signals_user_idempotency_key_idx
  on public.learning_signals(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.learning_signals
  drop constraint if exists learning_signals_signal_type_check;

alter table public.learning_signals
  add constraint learning_signals_signal_type_check check (signal_type in (
    'assessment_result',
    'question_mistake',
    'manual_mistake',
    'chat_confusion',
    'revision_review',
    'practice_attempt',
    'practice_requested',
    'confusion_detected',
    'concept_practiced',
    'doubt_asked',
    'source_upload',
    'self_reflection',
    'task_completion',
    'autopsy_memory_created'
  ));

create index if not exists learning_signals_user_source_created_idx
  on public.learning_signals(user_id, source_type, created_at desc);
-- Repair loop: canonical mistake/risk object, delayed retests, and
-- idempotent keys for "never lose the same mark twice".

alter table if exists public.mistakes
  add column if not exists concept text,
  add column if not exists mistake_text text,
  add column if not exists why_wrong text,
  add column if not exists exam_trap text,
  add column if not exists severity integer not null default 1,
  add column if not exists last_tested_at timestamptz,
  add column if not exists next_retest_at timestamptz,
  add column if not exists repaired_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists normalized_key text;

do $$
declare
  v_sql text;
  v_has_topic boolean;
  v_has_chapter boolean;
  v_has_category boolean;
  v_has_question_text boolean;
  v_has_ai_analysis boolean;
  v_has_improvement boolean;
  v_has_recovered boolean;
  v_has_recovered_at boolean;
begin
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'topic') into v_has_topic;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'chapter') into v_has_chapter;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'category') into v_has_category;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'question_text') into v_has_question_text;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'ai_analysis') into v_has_ai_analysis;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'improvement_suggestion') into v_has_improvement;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'recovered') into v_has_recovered;
  select exists (select 1 from information_schema.columns where table_name = 'mistakes' and column_name = 'recovered_at') into v_has_recovered_at;

  v_sql := 'update public.mistakes set ' ||
    'concept = coalesce(nullif(concept, ''''), ' ||
    (case when v_has_topic then 'nullif(topic, ''''), ' else '' end) ||
    (case when v_has_chapter then 'nullif(chapter, ''''), ' else '' end) ||
    (case when v_has_category then 'nullif(category::text, ''''), ' else '' end) ||
    '''Unclassified concept''), ' ||
    
    'mistake_text = coalesce(nullif(mistake_text, ''''), ' ||
    (case when v_has_question_text then 'nullif(question_text, ''''), ' else '' end) ||
    (case when v_has_ai_analysis then 'nullif(ai_analysis, ''''), ' else '' end) ||
    '''Unspecified mistake''), ' ||
    
    'why_wrong = coalesce(nullif(why_wrong, ''''), ' ||
    (case when v_has_ai_analysis then 'nullif(ai_analysis, ''''), ' else '' end) ||
    (case when v_has_improvement then 'nullif(improvement_suggestion, ''''), ' else '' end) ||
    'null), ' ||
    
    'severity = greatest(coalesce(severity, 1), 1), ' ||
    
    'status = case ' ||
    'when status in (''corrected_by_user'') ' ||
    (case when v_has_recovered then 'or recovered = true ' else '' end) ||
    'then ''repaired'' ' ||
    'when status in (''rejected'') then ''ignored'' ' ||
    'when status in (''pending_review'', ''verified_mistake'') or status is null then ''open'' ' ||
    'else status end, ' ||
    
    'repaired_at = case ' ||
    'when repaired_at is not null then repaired_at ' ||
    (case when v_has_recovered_at then 'when recovered_at is not null then recovered_at ' else '' end) ||
    (case when v_has_recovered then 'when recovered = true then now() ' else '' end) ||
    'else null end, ' ||
    
    'updated_at = coalesce(updated_at, created_at, now()), ' ||
    
    'normalized_key = coalesce(normalized_key, encode(digest(coalesce(public.normalize_academic_text(concept), '''') || chr(10) || coalesce(public.normalize_academic_text(mistake_text), ''''), ''sha256''), ''hex'')) ' ||
    
    'where concept is null or mistake_text is null or status in (''pending_review'', ''verified_mistake'', ''rejected'', ''corrected_by_user'') or normalized_key is null';

  execute v_sql;
exception
  when others then
    -- Absolute fallback
    update public.mistakes
    set
      concept = coalesce(concept, 'Unclassified concept'),
      mistake_text = coalesce(mistake_text, 'Unspecified mistake'),
      status = coalesce(status, 'open'),
      updated_at = coalesce(updated_at, now())
    where concept is null or mistake_text is null or status is null;
end $$;

alter table if exists public.mistakes
  alter column concept set not null,
  alter column concept set default 'Unclassified concept',
  alter column mistake_text set not null,
  alter column mistake_text set default 'Unspecified mistake',
  alter column status set default 'open';

alter table if exists public.mistakes
  drop constraint if exists mistakes_status_check;
alter table if exists public.mistakes
  add constraint mistakes_status_check
    check (status in (
      'open',
      'repairing',
      'retest_due',
      'repaired',
      'ignored',
      -- legacy statuses remain readable during upgrade/backfill windows.
      'pending_review',
      'verified_mistake',
      'rejected',
      'corrected_by_user'
    ));

alter table if exists public.mistakes
  drop constraint if exists mistakes_source_check;
alter table if exists public.mistakes
  add constraint mistakes_source_check
    check (source in ('quiz', 'autopsy', 'chat', 'manual', 'diagnostic'));

create index if not exists idx_mistakes_user_status_retest
  on public.mistakes(user_id, status, next_retest_at);
create index if not exists idx_mistakes_user_concept_key
  on public.mistakes(user_id, normalized_key);

do $$
begin
  create unique index if not exists idx_mistakes_user_normalized_key_unique
    on public.mistakes(user_id, normalized_key)
    where normalized_key is not null;
exception
  when unique_violation then
    raise notice 'Skipping unique mistake normalized_key index until existing duplicates are merged';
end $$;

create table if not exists public.mistake_retests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mistake_id uuid not null references public.mistakes(id) on delete cascade,
  goal_id uuid null references public.learning_goals(id) on delete set null,
  due_at timestamptz not null,
  question text not null,
  status text not null default 'due' check (status in ('due', 'passed', 'failed')),
  attempt_count integer not null default 0,
  last_attempted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mistake_retests enable row level security;
drop policy if exists "mistake_retests_select_own" on public.mistake_retests;
create policy "mistake_retests_select_own"
  on public.mistake_retests for select
  using (auth.uid() = user_id);
drop policy if exists "mistake_retests_insert_own" on public.mistake_retests;
create policy "mistake_retests_insert_own"
  on public.mistake_retests for insert
  with check (auth.uid() = user_id);
drop policy if exists "mistake_retests_update_own" on public.mistake_retests;
create policy "mistake_retests_update_own"
  on public.mistake_retests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "mistake_retests_delete_own" on public.mistake_retests;
create policy "mistake_retests_delete_own"
  on public.mistake_retests for delete
  using (auth.uid() = user_id);

create index if not exists idx_mistake_retests_user_due
  on public.mistake_retests(user_id, status, due_at);
create index if not exists idx_mistake_retests_mistake
  on public.mistake_retests(mistake_id, status, due_at);

do $$
begin
  create unique index if not exists idx_mistake_retests_one_due_per_mistake
    on public.mistake_retests(mistake_id)
    where status = 'due';
exception
  when unique_violation then
    raise notice 'Skipping one-due-retest index until duplicate due retests are merged';
end $$;

alter table if exists public.session_cards
  add column if not exists "targetMistakeId" uuid null references public.mistakes(id) on delete set null,
  add column if not exists "targetRetestId" uuid null references public.mistake_retests(id) on delete set null,
  add column if not exists "repairPhase" text null check ("repairPhase" in ('immediate_repair', 'delayed_retest'));
-- 20260607030000_mvp_production_hardening.sql
-- Canonical migration to ensure production DB has all schema elements
-- required by the MVP learning loop. Safe to re-run — uses IF NOT EXISTS
-- for all DDL statements.

-- ============================================================
-- A. practice_attempts idempotency_key
-- ============================================================
alter table public.practice_attempts
  add column if not exists idempotency_key text;

create unique index if not exists practice_attempts_user_id_idempotency_key_idx
  on public.practice_attempts(user_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================
-- B. agent_actions title field
-- ============================================================
alter table public.agent_actions
  add column if not exists title text;

-- Backfill title for existing rows
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

-- ============================================================
-- C. Required profiles fields referenced by runtime code
-- ============================================================
alter table public.profiles
  add column if not exists streak_days integer not null default 0;

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- ============================================================
-- D. revision_cards origin and approval_status (if referenced)
-- ============================================================
alter table public.revision_cards
  add column if not exists origin text default 'manual'
  check (origin in ('manual', 'chat', 'autopsy', 'practice', 'source'));

alter table public.revision_cards
  add column if not exists approval_status text default 'approved'
  check (approval_status in ('approved', 'pending', 'rejected'));

-- ============================================================
-- E. session_cards repair phase fields
-- ============================================================
alter table if exists public.session_cards
  add column if not exists "targetMistakeId" uuid null,
  add column if not exists "targetRetestId" uuid null,
  add column if not exists "repairPhase" text null
  check ("repairPhase" in ('immediate_repair', 'delayed_retest'));

-- ============================================================
-- F. Ensure rag_ingestion_jobs table and policies exist
-- (Required by ingest logic in lib/rag/ingest.ts)
-- ============================================================
create table if not exists public.rag_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.study_materials(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'extracting', 'chunking', 'embedding', 'completed', 'failed')),
  idempotency_key text,
  error text,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rag_jobs_user_material
  on public.rag_ingestion_jobs(user_id, material_id);

create index if not exists idx_rag_jobs_idempotency
  on public.rag_ingestion_jobs(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.rag_ingestion_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rag_ingestion_jobs'
    and policyname = 'Users access own rag_ingestion_jobs'
  ) then
    create policy "Users access own rag_ingestion_jobs"
      on public.rag_ingestion_jobs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- G. RAG query log for diagnostics
-- ============================================================
create table if not exists public.rag_query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  material_ids uuid[],
  retrieved_chunk_ids uuid[],
  total_chunks integer default 0,
  total_context_chars integer default 0,
  grounded boolean default false,
  mode text,
  created_at timestamptz not null default now()
);

create index if not exists idx_rag_query_logs_user_created
  on public.rag_query_logs(user_id, created_at desc);

alter table public.rag_query_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rag_query_logs'
    and policyname = 'Users access own rag_query_logs'
  ) then
    create policy "Users access own rag_query_logs"
      on public.rag_query_logs for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- H. Ensure study_material_chunks has correct columns
-- (Chunk content column — some schemas may have 'text', others 'content')
-- Create a view that aliases to 'content' for compatibility
-- ============================================================
do $$
begin
  -- If chunks table exists but has no 'content' column, rename 'text' to 'content'
  if exists (
    select 1 from information_schema.columns
    where table_name = 'study_material_chunks' and column_name = 'text'
    and not exists (
      select 1 from information_schema.columns
      where table_name = 'study_material_chunks' and column_name = 'content'
    )
  ) then
    alter table public.study_material_chunks rename column text to content;
  end if;
exception
  when undefined_column then
    raise notice 'Column text does not exist or content already present — skipping rename';
end $$;

-- ============================================================
-- I. Verify match_study_material_chunks RPC exists for RAG
-- Create if missing (fallback for keyword search)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'match_study_material_chunks'
    and pronamespace = (select oid from pg_namespace where nspname = 'public')
  ) then
    create or replace function public.match_study_material_chunks(
      query_embedding real[],
      match_user_id uuid,
      match_count int default 10,
      material_filter uuid[] default null,
      subject_filter text default null,
      chapter_filter text default null,
      similarity_threshold float default 0.5
    ) returns table(
      id uuid,
      material_id uuid,
      material_title text,
      source_type text,
      subject text,
      chapter text,
      heading text,
      page_start int,
      page_end int,
      text text,
      similarity float
    ) as $func$
    begin
      return query
      select
        smc.id,
        smc.material_id,
        sm.title as material_title,
        sm.source_type,
        sm.subject,
        sm.chapter,
        smc.heading,
        smc.page_start,
        smc.page_end,
        smc.content as text,
        1.0 as similarity
      from study_material_chunks smc
      join study_materials sm on sm.id = smc.material_id
      where smc.user_id = match_user_id
        and sm.status = 'ready'
        and (material_filter is null or smc.material_id = any(material_filter))
        and (subject_filter is null or sm.subject = subject_filter)
        and (chapter_filter is null or sm.chapter = chapter_filter)
        and smc.content ilike '%' || subject_filter || '%'
      order by smc.updated_at desc
      limit match_count;
    end;
    $func$ language plpgsql volatile security definer;
  end if;
end $$;

-- ============================================================
-- J. Ensure practice_items has concept_id and concept_name
-- ============================================================
alter table if exists public.practice_items
  add column if not exists concept_id uuid,
  add column if not exists concept_name text;

-- ============================================================
-- K. Ensure practice_sets has goal_id
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'practice_sets' and column_name = 'goal_id'
  ) then
    alter table public.practice_sets
      add column goal_id uuid references public.learning_goals(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- L. Ensure mistakes has normalized_key and repair fields
-- ============================================================
alter table if exists public.mistakes
  add column if not exists normalized_key text,
  add column if not exists concept text,
  add column if not exists mistake_text text,
  add column if not exists why_wrong text,
  add column if not exists exam_trap text,
  add column if not exists severity integer not null default 1,
  add column if not exists last_tested_at timestamptz,
  add column if not exists next_retest_at timestamptz,
  add column if not exists repaired_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_mistakes_user_status_retest
  on public.mistakes(user_id, status, next_retest_at);
create index if not exists idx_mistakes_user_concept_key
  on public.mistakes(user_id, normalized_key);

-- ============================================================
-- M. Ensure profiles has exam_type column
-- ============================================================
alter table if exists public.profiles
  add column if not exists exam_type text;

-- ============================================================
-- N. learning_goals needs these columns for session card logic
-- ============================================================
alter table if exists public.learning_goals
  add column if not exists target_level text,
  add column if not exists progress integer default 0;-- Migration: 20260608000000_session_card_canonical_upsert.sql
-- Purpose: Enforce exactly one canonical daily session card per user/date/goal.
-- Fixes Supabase upsert issues with partial unique indexes and ensures atomic RPCs.

-- 1. Add goal_key generated column for canonical uniqueness
-- Use the "Zero UUID" for null goal_id
ALTER TABLE public.session_cards
  ADD COLUMN IF NOT EXISTS goal_key UUID 
  GENERATED ALWAYS AS (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

-- 2. Clean up duplicate cards before applying constraint
-- (Keeps the most recently updated card for each user/date/goal_key)
WITH ranked_cards AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, date, goal_key 
           ORDER BY created_at DESC
         ) as rn
  FROM public.session_cards
)
DELETE FROM public.session_cards
WHERE id IN (SELECT id FROM ranked_cards WHERE rn > 1);

-- 3. Drop existing problematic partial indexes and constraints
ALTER TABLE public.session_cards DROP CONSTRAINT IF EXISTS session_cards_user_id_date_key;
DROP INDEX IF EXISTS public.session_cards_user_date_global_unique;
DROP INDEX IF EXISTS public.session_cards_user_date_goal_unique;
DROP INDEX IF EXISTS public.idx_session_cards_user_date_goal_not_null;

-- 4. Create the canonical unique constraint
ALTER TABLE public.session_cards
  ADD CONSTRAINT session_cards_canonical_unique UNIQUE (user_id, date, goal_key);

-- 5. Create atomic RPC for session card upsert
CREATE OR REPLACE FUNCTION public.upsert_session_card(
  p_row JSONB
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_date DATE;
  v_goal_id UUID;
  v_goal_key UUID;
  v_result JSONB;
BEGIN
  v_user_id := (p_row->>'user_id')::UUID;
  v_date := (p_row->>'date')::DATE;
  v_goal_id := (p_row->>'goal_id')::UUID;
  v_goal_key := COALESCE(v_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ensure authorized
  IF auth.uid() IS NULL OR auth.uid() <> v_user_id THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  INSERT INTO public.session_cards (
    user_id, date, goal_id, learner_state_version,
    "dayNumber", "streakDays", "focusTopic", subject,
    "estimatedMinutes", rationale, "daysToExam", "overdueCards",
    "masteryPercent", "closingMessage", task_type, resource_type,
    target_concept_id, priority, "taskType", "resourceType",
    "targetConceptId", selection_reason, mistake_count,
    weak_concept_count, has_active_goal, "selectionReason",
    "mistakeCount", "weakConceptCount", "hasActiveGoal",
    "targetMistakeId", "targetRetestId", "repairPhase",
    source_signals, created_at
  )
  VALUES (
    v_user_id, v_date, v_goal_id, (p_row->>'learner_state_version')::INT,
    (p_row->>'dayNumber')::INT, (p_row->>'streakDays')::INT, p_row->>'focusTopic', p_row->>'subject',
    (p_row->>'estimatedMinutes')::INT, p_row->>'rationale', (p_row->>'daysToExam')::INT, (p_row->>'overdueCards')::INT,
    (p_row->>'masteryPercent')::NUMERIC, p_row->>'closingMessage', p_row->>'task_type', p_row->>'resource_type',
    (p_row->>'target_concept_id')::UUID, p_row->>'priority', p_row->>'taskType', p_row->>'resourceType',
    (p_row->>'targetConceptId')::UUID, p_row->>'selection_reason', (p_row->>'mistake_count')::INT,
    (p_row->>'weak_concept_count')::INT, (p_row->>'has_active_goal')::BOOLEAN, p_row->>'selectionReason',
    (p_row->>'mistakeCount')::INT, (p_row->>'weakConceptCount')::INT, (p_row->>'hasActiveGoal')::BOOLEAN,
    (p_row->>'targetMistakeId')::UUID, (p_row->>'targetRetestId')::UUID, p_row->>'repairPhase',
    COALESCE(p_row->'source_signals', '{}'::jsonb), NOW()
  )
  ON CONFLICT (user_id, date, goal_key) DO UPDATE
  SET
    learner_state_version = EXCLUDED.learner_state_version,
    "dayNumber" = EXCLUDED."dayNumber",
    "streakDays" = EXCLUDED."streakDays",
    "focusTopic" = EXCLUDED."focusTopic",
    subject = EXCLUDED.subject,
    "estimatedMinutes" = EXCLUDED."estimatedMinutes",
    rationale = EXCLUDED.rationale,
    "daysToExam" = EXCLUDED."daysToExam",
    "overdueCards" = EXCLUDED."overdueCards",
    "masteryPercent" = EXCLUDED."masteryPercent",
    "closingMessage" = EXCLUDED."closingMessage",
    task_type = EXCLUDED.task_type,
    resource_type = EXCLUDED.resource_type,
    target_concept_id = EXCLUDED.target_concept_id,
    priority = EXCLUDED.priority,
    "taskType" = EXCLUDED."taskType",
    "resourceType" = EXCLUDED."resourceType",
    "targetConceptId" = EXCLUDED."targetConceptId",
    selection_reason = EXCLUDED.selection_reason,
    mistake_count = EXCLUDED.mistake_count,
    weak_concept_count = EXCLUDED.weak_concept_count,
    has_active_goal = EXCLUDED.has_active_goal,
    "selectionReason" = EXCLUDED."selectionReason",
    "mistakeCount" = EXCLUDED."mistakeCount",
    "weakConceptCount" = EXCLUDED."weakConceptCount",
    "hasActiveGoal" = EXCLUDED."hasActiveGoal",
    "targetMistakeId" = EXCLUDED."targetMistakeId",
    "targetRetestId" = EXCLUDED."targetRetestId",
    "repairPhase" = EXCLUDED."repairPhase",
    source_signals = EXCLUDED.source_signals,
    created_at = NOW()
  RETURNING to_jsonb(public.session_cards.*) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.upsert_session_card(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_session_card(JSONB) TO authenticated;

-- 6. Update complete_daily_session_card to handle goal_id and use goal_key
CREATE OR REPLACE FUNCTION public.complete_daily_session_card(
  p_user_id   UUID,
  p_goal_id   UUID DEFAULT NULL,
  p_date      DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_updated   INT;
  v_version   INT;
  v_goal_key  UUID;
BEGIN
  v_goal_key := COALESCE(p_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ensure authorized
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  -- Mark card completed
  UPDATE public.session_cards
  SET
    "isCompleted"  = TRUE,
    "completedAt"  = NOW(),
    is_completed   = TRUE,
    completed_at   = NOW(),
    created_at     = NOW()
  WHERE user_id = p_user_id
    AND date    = p_date
    AND goal_key = v_goal_key
    AND ("isCompleted" = FALSE OR "isCompleted" IS NULL);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Bump learner state version
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    created_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'updated', v_updated,
    'newVersion', v_version,
    'date', p_date,
    'goalId', p_goal_id
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_daily_session_card(UUID, UUID, DATE) TO authenticated;

-- 7. Update invalidate_session_card to handle goal_id and use goal_key
CREATE OR REPLACE FUNCTION public.invalidate_session_card(
  p_user_id UUID,
  p_goal_id UUID DEFAULT NULL,
  p_reason  TEXT DEFAULT 'manual_invalidation'
) RETURNS JSONB AS $$
DECLARE
  v_version INT;
  v_deleted INT := 0;
  v_goal_key UUID;
BEGIN
  v_goal_key := COALESCE(p_goal_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Ensure authorized
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'unauthorized';
    END IF;
  END IF;

  -- Delete today and tomorrow for this user/goal
  DELETE FROM public.session_cards
  WHERE user_id = p_user_id
    AND date IN (CURRENT_DATE, CURRENT_DATE + 1)
    AND goal_key = v_goal_key;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Bump version
  UPDATE public.profiles
  SET
    learner_state_version = COALESCE(learner_state_version, 0) + 1,
    created_at = NOW()
  WHERE id = p_user_id
  RETURNING learner_state_version INTO v_version;

  RETURN JSONB_BUILD_OBJECT(
    'deleted', v_deleted,
    'newVersion', v_version,
    'reason', p_reason,
    'goalId', p_goal_id
  );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.invalidate_session_card(UUID, UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.invalidate_session_card(UUID, UUID, TEXT) TO authenticated;
-- Migration: 20260610000000_public_launch_rls_hardening.sql
-- Purpose: Module 4 — RLS hardening and billing column reconciliation for public launch.
-- Ensures all launch-critical columns exist, RLS is forced on user-data tables,
-- and that anonymous RPCs are locked down.

DO $$
BEGIN

-- ============================================================
-- 1. Billing Column Reconciliation (idempotent)
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manual_plan text NOT NULL DEFAULT 'free';

-- Create index on stripe_customer_id for webhook lookups
IF NOT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE tablename = 'profiles' AND indexname = 'idx_profiles_stripe_customer_id'
) THEN
  CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
END IF;

-- ============================================================
-- 2. Force RLS on all core user-data tables
-- ============================================================
-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Learning
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_goals FORCE ROW LEVEL SECURITY;

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.session_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_cards FORCE ROW LEVEL SECURITY;

-- Chat
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;

-- Materials
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials FORCE ROW LEVEL SECURITY;

-- Autopsy
ALTER TABLE public.mock_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_autopsies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.autopsy_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopsy_reports FORCE ROW LEVEL SECURITY;

-- Concepts
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts FORCE ROW LEVEL SECURITY;

-- Revision Cards
ALTER TABLE public.revision_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_cards FORCE ROW LEVEL SECURITY;

-- Mistakes
ALTER TABLE public.mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistakes FORCE ROW LEVEL SECURITY;

-- Usage
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily FORCE ROW LEVEL SECURITY;

-- Agent Runtime
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;


-- ============================================================
-- 3. Ensure profiles RLS policy covers service_role bypass
-- ============================================================
-- service_role is already granted BYPASSRLS in Supabase by default.
-- We just need to verify authenticated users can only see their own rows.
-- Drop and recreate the canonical self-access policy idempotently.

DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;
CREATE POLICY "profiles_self_access"
  ON public.profiles
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

END $$;

-- ============================================================
-- 4. Service role grants (safe to rerun)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
-- Migration: 20260610000001_chat_turn_status.sql
-- Purpose: Module 6 — Add turn_status and prompt_version tracking to chat_messages.
-- This enables recovery from partial chat turns (provider failed after user message saved).

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS turn_status text
    NOT NULL DEFAULT 'completed'
    CHECK (turn_status IN (
      'pending_user_saved',
      'assistant_streaming',
      'assistant_saved',
      'failed_usage',
      'failed_provider',
      'failed_internal',
      'completed'
    )),
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Unique index to prevent duplicate assistant turns per idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_idempotency_key_uniq
  ON public.chat_messages(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Index for finding failed turns for recovery UI
CREATE INDEX IF NOT EXISTS chat_messages_failed_turns_idx
  ON public.chat_messages(user_id, turn_status, created_at)
  WHERE turn_status IN ('failed_provider', 'failed_internal');

-- Index for session message loading (with status filter)
CREATE INDEX IF NOT EXISTS chat_messages_session_status_idx
  ON public.chat_messages(session_id, turn_status, created_at);
-- Migration: 20260610000002_rag_material_deletion_cascade.sql
-- Purpose: Module 7 — Storage deletion audit column + ensure material deletion
-- marks chunks/embeddings for cleanup when a material is deleted.

-- Add deleted_at soft-delete column to study_materials
ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- Add index for soft-delete queries
CREATE INDEX IF NOT EXISTS study_materials_deleted_at_idx
  ON public.study_materials(user_id, deleted_at)
  WHERE deleted_at IS NOT NULL;

-- When a material is soft-deleted, mark its chunks as orphaned
-- so the RAG retrieval engine excludes them and a cleanup job can purge.
ALTER TABLE public.study_material_chunks
  ADD COLUMN IF NOT EXISTS orphaned_at timestamptz;

CREATE INDEX IF NOT EXISTS material_chunks_orphaned_idx
  ON public.study_material_chunks(orphaned_at)
  WHERE orphaned_at IS NOT NULL;

-- Function: cascade orphan chunks when material is soft-deleted
CREATE OR REPLACE FUNCTION public.cascade_orphan_chunks_on_material_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.study_material_chunks
    SET orphaned_at = NEW.deleted_at
    WHERE material_id = NEW.id
      AND orphaned_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_orphan_chunks ON public.study_materials;
CREATE TRIGGER trg_cascade_orphan_chunks
  AFTER UPDATE OF deleted_at ON public.study_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_orphan_chunks_on_material_delete();

-- Storage privacy: ensure study_materials has correct user_id ownership
-- (storage bucket policy is managed via Supabase dashboard / Storage policies)
-- This migration documents the requirement for audit purposes.
COMMENT ON TABLE public.study_materials IS
  'User study materials. Storage objects are user-scoped under storage/study-materials/{user_id}/*.
   Deletion must soft-delete this row and orphan chunks. Storage object cleanup is deferred to a cron worker.';
-- Module 9 Phase 9.1: ATLAS Concept Mastery Engine Hardening
-- Add last_updated_reason and evidence_count to concepts for explainability

ALTER TABLE public.concepts 
  ADD COLUMN IF NOT EXISTS last_updated_reason text,
  ADD COLUMN IF NOT EXISTS evidence_count integer not null default 0;
-- Module 9 Phase 9.2: ATLAS Concept Resolution Hardening
-- Add goal_id to concepts for exam-specific tracking and create unique index

ALTER TABLE public.concepts
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE;

-- Drop the old unique index on user/concept_key if it exists
DROP INDEX IF EXISTS idx_concepts_user_concept_key_unique;

-- Create the new canonical unique index: user + goal + concept_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_concepts_user_goal_concept_key_unique
  ON public.concepts(user_id, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), concept_key)
  WHERE concept_key IS NOT NULL;
-- Module 10 Phase 10.1: Revision Cards Hardening
-- Add goal_id and status to revision_cards

ALTER TABLE public.revision_cards
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source_event_id UUID;

-- Drop the old unique index that didn't include goal_id
DROP INDEX IF EXISTS idx_revision_cards_user_normalized_key;

-- Create the new canonical unique index: user + goal + concept + normalized_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_revision_cards_user_goal_concept_key_unique
  ON public.revision_cards(user_id, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(concept_id, '00000000-0000-0000-0000-000000000000'::uuid), normalized_key)
  WHERE normalized_key IS NOT NULL AND status = 'active';

-- Ensure normalized_key is computed via trigger if missing? 
-- The engine layer already computes it, but we can make it NOT NULL down the line. 
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
  for each row execute function update_updated_at();-- Stabilize event leasing for MVP
-- Replaces acquire_event_leases_for_user with safe consumers

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
        'learning_state_engine',
        'atlas_engine',
        'memory_engine',
        'atlas_agent',
        'memory_agent',
        'planner_agent',
        'command_agent',
        'mind_agent',
        'rag_agent',
        'amaura_session_agent',
        'amaura_practice_agent',
        'amaura_autopsy_cascade',
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
    limit greatest(1, least(p_limit, 5))
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
  for each row execute function update_updated_at();-- Stabilize event leasing for MVP
-- Replaces acquire_event_leases_for_user with safe consumers

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
        'learning_state_engine',
        'atlas_engine',
        'memory_engine',
        'atlas_agent',
        'memory_agent',
        'planner_agent',
        'command_agent',
        'mind_agent',
        'rag_agent',
        'amaura_session_agent',
        'amaura_practice_agent',
        'amaura_autopsy_cascade',
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
    limit greatest(1, least(p_limit, 5))
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
-- Confirm migration state after repair\n-- This migration does nothing but ensures the migration system recognizes the current state
-- Migration: 20260617000002_mvp_schema_reconciliation.sql
-- Purpose: Final schema reconciliation for Cognition OS MVP.
-- Ensures all runtime-required columns, constraints, and idempotency keys exist.
-- This migration is safe to run on both fresh and existing databases.

DO $$
BEGIN

-- 1. Profiles Reconciliation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS exam_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS learner_state_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

-- Drop legacy constraint if it exists
IF EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_name = 'profiles_exam_type_check' AND table_schema = 'public'
) THEN
  ALTER TABLE public.profiles DROP CONSTRAINT profiles_exam_type_check;
END IF;


-- 2. Revision Cards Hardening
ALTER TABLE public.revision_cards ADD COLUMN IF NOT EXISTS normalized_key text;

-- Add unique constraint for revision cards idempotency
IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'revision_cards' AND indexname = 'idx_revision_cards_user_normalized_key'
) THEN
  CREATE UNIQUE INDEX idx_revision_cards_user_normalized_key 
    ON public.revision_cards(user_id, normalized_key) 
    WHERE normalized_key IS NOT NULL;
END IF;


-- 3. Learning Events Hardening
-- Ensure learner_events exists (some legacy DBs might call it something else)
CREATE TABLE IF NOT EXISTS public.learner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  idempotency_key text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.learner_events ADD COLUMN IF NOT EXISTS idempotency_key text;

IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'learner_events' AND indexname = 'idx_learner_events_user_idempotency'
) THEN
  CREATE UNIQUE INDEX idx_learner_events_user_idempotency 
    ON public.learner_events(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
END IF;


-- 4. Session Cards Canonicalization (Reconciliation)
-- This ensures the work from 20260608000000 is present and stable.
ALTER TABLE public.session_cards 
  ADD COLUMN IF NOT EXISTS goal_key UUID 
  GENERATED ALWAYS AS (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

-- Drop old non-canonical unique index if it exists
DROP INDEX IF EXISTS public.idx_session_cards_user_date;

-- Ensure canonical unique constraint
IF NOT EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_name = 'session_cards_canonical_unique' AND table_schema = 'public'
) THEN
  -- Cleanup potential duplicates before applying
  WITH ranked_cards AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, date, goal_key ORDER BY updated_at DESC) as rn
    FROM public.session_cards
  )
  DELETE FROM public.session_cards WHERE id IN (SELECT id FROM ranked_cards WHERE rn > 1);

  ALTER TABLE public.session_cards
    ADD CONSTRAINT session_cards_canonical_unique UNIQUE (user_id, date, goal_key);
END IF;


-- 5. Autopsy Projection & Mistake Hardening
ALTER TABLE public.mistakes ADD COLUMN IF NOT EXISTS idempotency_key text;

IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'mistakes' AND indexname = 'idx_mistakes_user_idempotency'
) THEN
  CREATE UNIQUE INDEX idx_mistakes_user_idempotency 
    ON public.mistakes(user_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
END IF;

-- Ensure autopsy_reports has the generating/generated_by status
ALTER TABLE public.autopsy_reports ADD COLUMN IF NOT EXISTS status text DEFAULT 'ready';
ALTER TABLE public.autopsy_reports ADD COLUMN IF NOT EXISTS generated_by text DEFAULT 'deterministic';


-- 6. Concepts Mastery Reconciliation
ALTER TABLE public.concepts ADD COLUMN IF NOT EXISTS mastery_score numeric DEFAULT 0;
ALTER TABLE public.concepts ADD COLUMN IF NOT EXISTS forgetting double precision;
ALTER TABLE public.concepts ADD COLUMN IF NOT EXISTS concept_key text;


-- 7. Future-Dated Migration Safety (Hermes / Combined)
-- These tables are expected by the agent runtime. 
-- We ensure they exist with the right types if future migrations haven't run yet.

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  idempotency_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure agent_runs has all required columns for the runtime
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS goal_id uuid;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat';
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS plan jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS mutation_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure unique index on agent_runs idempotency
IF NOT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE tablename = 'agent_runs' AND indexname = 'idx_agent_runs_user_idempotency_unique'
) THEN
  CREATE UNIQUE INDEX idx_agent_runs_user_idempotency_unique
    ON public.agent_runs(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
END IF;

END $$;

-- 8. Grants for Service Role
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
CREATE TABLE IF NOT EXISTS public.learning_state_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  tool_name text,
  event_type text,
  concept_id uuid references public.concepts(id) on delete set null,
  before_state jsonb default '{}'::jsonb,
  after_state jsonb default '{}'::jsonb,
  diff_summary jsonb default '{}'::jsonb,
  policy_decision text,
  created_at timestamptz default now()
);

-- RLS
ALTER TABLE public.learning_state_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning state changes" 
  ON public.learning_state_changes 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- System bypass or Service Role insert
CREATE POLICY "Service Role full access to learning_state_changes"
  ON public.learning_state_changes
  USING (true)
  WITH CHECK (true);
-- Add columns for NotebookLM-style features to study_materials
ALTER TABLE public.study_materials 
ADD COLUMN IF NOT EXISTS briefing_doc jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS podcast_transcript jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS audio_overview_url text;

-- Add a status for NotebookLM background processing
ALTER TABLE public.study_materials
ADD COLUMN IF NOT EXISTS deep_processing_status text DEFAULT 'pending' CHECK (deep_processing_status IN ('pending', 'processing', 'completed', 'failed'));
-- Migration: 20260618000002_fix_session_idempotency.sql
-- Purpose: Make complete_study_session idempotent by looking up the completion_key before inserting.

create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
  v_current_streak int;
  v_last_active_at timestamptz;
  v_new_streak int;
  v_streak_changed boolean := false;
  v_today date := current_date;
  v_last_active_date date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- 1. Idempotency Check
  if p_completion_key is not null then
    select id into v_session_id
    from public.study_sessions
    where user_id = p_user_id
      and metadata->>'completion_key' = p_completion_key
    limit 1;

    if v_session_id is not null then
      -- Get existing streak to return without mutating
      select streak_days into v_current_streak
      from public.profiles
      where id = p_user_id;
      
      return jsonb_build_object(
        'session_id', v_session_id,
        'streak_days', coalesce(v_current_streak, 0),
        'streak_changed', false,
        'idempotent_replay', true
      );
    end if;
  end if;

  -- 2. Get current streak
  select streak_days, last_active_at into v_current_streak, v_last_active_at
  from public.profiles
  where id = p_user_id
  for update;
  
  v_current_streak := coalesce(v_current_streak, 0);
  v_last_active_date := v_last_active_at::date;
  
  if v_last_active_date = v_today then
    -- Already active today
    v_new_streak := greatest(v_current_streak, 1);
  elsif v_last_active_date = v_today - interval '1 day' then
    -- Active yesterday
    v_new_streak := v_current_streak + 1;
    v_streak_changed := true;
  else
    -- Gap or new
    v_new_streak := 1;
    v_streak_changed := true;
  end if;

  -- 3. Update profile
  update public.profiles
  set streak_days = v_new_streak,
      last_active_at = now(),
      updated_at = now(),
      learner_state_version = coalesce(learner_state_version, 0) + 1
  where id = p_user_id;

  -- 4. Insert study session
  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- 5. Create event atomically
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'STUDY_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'streak_days', v_new_streak,
    'streak_changed', v_streak_changed,
    'idempotent_replay', false
  );
end;
$$ language plpgsql security definer set search_path = public;
-- Migration: 20260618000003_stripe_subscription_persistence.sql
-- Purpose: Add more Stripe subscription state columns to profiles to fix P0.7.

alter table public.profiles
add column if not exists stripe_subscription_id text,
add column if not exists stripe_price_id text,
add column if not exists subscription_provider_status text,
add column if not exists subscription_current_period_end timestamptz,
add column if not exists subscription_cancel_at_period_end boolean,
add column if not exists billing_updated_at timestamptz;
-- Migration: 20260618000005_admin_users_and_stripe_constraints.sql
-- Purpose: Create admin_users table and add unique constraints for Stripe IDs to fix P0 blockers.

-- 1. Create admin_users table for explicit admin authorization
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'support')),
  created_at timestamptz default now()
);

-- Enable RLS on admin_users
alter table public.admin_users enable row level security;

-- Admins can read their own row (or others can too depending on need, keeping it strictly to self and service role for now)
create policy "Users can read their own admin role"
  on public.admin_users for select
  to authenticated
  using (auth.uid() = user_id);

-- 2. Add unique constraints to profiles for stripe columns
-- We only add these if they don't already exist, but postgres doesn't easily support "if not exists" for constraints directly without DO blocks.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_stripe_customer_id_key') then
    alter table public.profiles add constraint profiles_stripe_customer_id_key unique (stripe_customer_id);
  end if;
  
  if not exists (select 1 from pg_constraint where conname = 'profiles_stripe_subscription_id_key') then
    alter table public.profiles add constraint profiles_stripe_subscription_id_key unique (stripe_subscription_id);
  end if;
end $$;
