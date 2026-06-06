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
