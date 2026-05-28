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
  card_id uuid references revision_cards(id) on delete set null,
  
  title text not null,
  description text,
  category text not null check (category in ('study','revise','practice','mock','break','autopsy_recovery')),
  priority float default 0,
  estimated_minutes int default 15,
  
  scheduled_for date not null,
  scheduled_slot int,
  status text default 'pending' check (status in ('pending','in_progress','completed','skipped','cancelled')),
  
  completed_at timestamptz,
  actual_minutes int,
  
  source text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_study_tasks_user_date on study_tasks(user_id, scheduled_for, status);

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
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  parent_event_id uuid references events(id),
  status text default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  attempts int default 0,
  last_error text,
  created_at timestamptz default now(),
  processed_at timestamptz,
  completed_at timestamptz
);

create index idx_events_status on events(status, created_at) where status in ('pending','processing');
create index idx_events_user on events(user_id, created_at desc);

create table if not exists event_consumers (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  consumer_name text not null,
  status text default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  attempts int default 0,
  last_error text,
  processed_at timestamptz,
  unique(event_id, consumer_name)
);

create index idx_event_consumers_pending on event_consumers(status, event_id) where status in ('pending','processing');

create table if not exists event_dead_letter (
  id uuid primary key default uuid_generate_v4(),
  original_event_id uuid,
  event_type text,
  payload jsonb,
  consumer_name text,
  error text,
  attempts int,
  failed_at timestamptz default now()
);

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
