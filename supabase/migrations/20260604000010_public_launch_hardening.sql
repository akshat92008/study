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
