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
