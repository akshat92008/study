-- Close remaining executable MVP loop gaps:
-- - COMMAND is no longer an active event consumer.
-- - AUTOPSY uploads can be queued as durable jobs.
-- - ATLAS concepts and MEMORY cards get canonical dedupe keys.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

do $$
begin
  alter type public.event_status add value if not exists 'PARTIAL_FAILED';
exception
  when undefined_object then null;
end $$;

create or replace function public.normalize_academic_text(p_value text)
returns text as $$
declare
  v text;
  word text;
  words text[] := array[]::text[];
begin
  if p_value is null then
    return null;
  end if;

  v := lower(unaccent(p_value));
  v := replace(v, '&', ' and ');
  v := regexp_replace(v, '[^a-z0-9]+', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));

  if v = '' then
    return null;
  end if;

  foreach word in array string_to_array(v, ' ')
  loop
    if word in ('and', 'the', 'of') then
      continue;
    end if;
    if length(word) > 4 and right(word, 3) = 'ies' then
      word := left(word, length(word) - 3) || 'y';
    elsif length(word) > 3 and right(word, 1) = 's' then
      word := left(word, length(word) - 1);
    end if;
    words := array_append(words, word);
  end loop;

  v := array_to_string(words, ' ');
  return nullif(v, '');
end;
$$ language plpgsql immutable set search_path = public;

create or replace function public.normalize_academic_chapter(p_value text)
returns text as $$
declare
  v text := public.normalize_academic_text(p_value);
begin
  if v in (
    'electrostatic',
    'electrostatics',
    'electric charge field',
    'electric charge fields',
    'electric charges field',
    'electric charges fields'
  ) then
    return 'electric charge field';
  end if;
  return v;
end;
$$ language plpgsql immutable set search_path = public;

create or replace function public.normalize_academic_subject(p_value text)
returns text as $$
declare
  raw text := lower(coalesce(p_value, ''));
  v text := public.normalize_academic_text(p_value);
begin
  if raw like '%physics%' then
    return 'physics';
  end if;
  if raw ~ 'mathematics|maths|math' then
    return 'mathematics';
  end if;
  return v;
end;
$$ language plpgsql immutable set search_path = public;

alter table public.concepts
  add column if not exists normalized_subject text,
  add column if not exists normalized_chapter text,
  add column if not exists normalized_name text,
  add column if not exists concept_key text;

update public.concepts
set
  normalized_subject = public.normalize_academic_subject(subject),
  normalized_chapter = public.normalize_academic_chapter(chapter),
  normalized_name = public.normalize_academic_text(coalesce(name, topic, chapter)),
  concept_key = concat_ws(
    '::',
    coalesce(public.normalize_academic_subject(subject), 'general'),
    coalesce(public.normalize_academic_chapter(chapter), 'general'),
    coalesce(public.normalize_academic_text(coalesce(name, topic, chapter)), public.normalize_academic_chapter(chapter), 'general')
  )
where concept_key is null
   or normalized_subject is null
   or normalized_chapter is null
   or normalized_name is null;

create or replace function public.set_concept_canonical_fields()
returns trigger as $$
begin
  new.normalized_subject := public.normalize_academic_subject(new.subject);
  new.normalized_chapter := public.normalize_academic_chapter(new.chapter);
  new.normalized_name := public.normalize_academic_text(coalesce(new.name, new.topic, new.chapter));
  new.concept_key := concat_ws(
    '::',
    coalesce(new.normalized_subject, 'general'),
    coalesce(new.normalized_chapter, 'general'),
    coalesce(new.normalized_name, new.normalized_chapter, 'general')
  );
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_set_concept_canonical_fields on public.concepts;
create trigger trg_set_concept_canonical_fields
before insert or update of subject, chapter, topic, name
on public.concepts
for each row execute function public.set_concept_canonical_fields();

do $$
begin
  create unique index if not exists idx_concepts_user_concept_key_unique
    on public.concepts(user_id, concept_key)
    where concept_key is not null;
exception
  when unique_violation then
    raise notice 'Skipping unique concept_key index until existing duplicate concepts are merged';
end $$;

alter table public.revision_cards
  add column if not exists normalized_key text;

update public.revision_cards
set normalized_key = encode(
  digest(
    coalesce(user_id::text, '') || chr(10) ||
    coalesce(concept_id::text, 'no-concept') || chr(10) ||
    coalesce(source_type, 'manual') || chr(10) ||
    coalesce(source_id, 'no-source') || chr(10) ||
    coalesce(public.normalize_academic_text(front), ''),
    'sha256'
  ),
  'hex'
)
where normalized_key is null;

do $$
begin
  create unique index if not exists idx_revision_cards_user_normalized_key_unique
    on public.revision_cards(user_id, normalized_key)
    where normalized_key is not null;
exception
  when unique_violation then
    raise notice 'Skipping unique revision card normalized_key index until existing duplicates are merged';
end $$;

create table if not exists public.autopsy_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'needs_user_input')),
  test_name text,
  exam_type text,
  payload jsonb not null default '{}'::jsonb,
  source text,
  idempotency_key text not null,
  retry_count integer not null default 0,
  result_autopsy_id uuid references public.mock_autopsies(id) on delete set null,
  error_message text,
  processing_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.autopsy_jobs enable row level security;
drop policy if exists "users_all_own_autopsy_jobs" on public.autopsy_jobs;
create policy "users_all_own_autopsy_jobs"
  on public.autopsy_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "service_role_all_autopsy_jobs" on public.autopsy_jobs;
create policy "service_role_all_autopsy_jobs"
  on public.autopsy_jobs for all
  using (current_setting('request.jwt.claim.role', true) = 'service_role')
  with check (current_setting('request.jwt.claim.role', true) = 'service_role');

create index if not exists idx_autopsy_jobs_status_created
  on public.autopsy_jobs(status, created_at);
create index if not exists idx_autopsy_jobs_user_created
  on public.autopsy_jobs(user_id, created_at desc);

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
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine']
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
  from public, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb)
  to service_role;

delete from public.consumer_locks
where consumer_name = 'command_engine';

do $migration$
declare
  v_signature regprocedure := 'public.ingest_mock_autopsy(uuid,text,text,integer,integer,integer,integer,numeric,numeric,numeric,jsonb,text,uuid,numeric)'::regprocedure;
  v_definition text;
  v_rewritten text;
begin
  select pg_get_functiondef(v_signature) into v_definition;
  v_rewritten := regexp_replace(
    v_definition,
    $pattern$if auth\.uid\(\) is null or auth\.uid\(\) <> p_user_id then\s+raise exception 'unauthorized';\s+end if;$pattern$,
    $replacement$if current_setting('request.jwt.claim.role', true) <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_user_id) then
    raise exception 'unauthorized';
  end if;$replacement$,
    'm'
  );

  if v_rewritten <> v_definition then
    execute v_rewritten;
  end if;
end
$migration$;

revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public;

grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated, service_role;
