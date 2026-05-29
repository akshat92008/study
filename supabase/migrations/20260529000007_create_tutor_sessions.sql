-- Migration: Create tutor_sessions table

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

create index if not exists idx_tutor_sessions_user on tutor_sessions(user_id);
create index if not exists idx_tutor_sessions_session on tutor_sessions(session_id);

alter table tutor_sessions enable row level security;

create policy "Users access own tutor_sessions" on tutor_sessions
  for all using (auth.uid() = user_id);

create trigger tutor_sessions_updated_at
  before update on tutor_sessions
  for each row execute function update_updated_at();
