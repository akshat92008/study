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
