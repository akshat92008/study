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
