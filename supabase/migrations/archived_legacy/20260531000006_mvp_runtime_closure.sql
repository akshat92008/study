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
