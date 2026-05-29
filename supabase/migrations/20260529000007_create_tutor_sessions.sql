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
