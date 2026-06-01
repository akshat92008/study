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
  created_at timestamptz not null default now(),
  unique(user_id, material_id, chunk_id, concept_id)
);

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
