-- Migration: 20260530000005_mvp_critical_hardening.sql
-- Purpose: close MVP production blockers that must hold on both fresh and upgraded databases.

-- ---------------------------------------------------------------------------
-- RLS and policy repair
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Stronger duplicate prevention and provenance
-- ---------------------------------------------------------------------------
alter table public.revision_cards
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_hash text,
  add column if not exists verified boolean not null default false,
  add column if not exists confidence numeric,
  add column if not exists origin_event_id uuid;

create unique index if not exists idx_revision_cards_unique_source
  on public.revision_cards(user_id, source_type, source_id, source_hash)
  where source_type is not null and source_id is not null and source_hash is not null;

create unique index if not exists idx_study_sessions_completion_key
  on public.study_sessions(user_id, (metadata->>'completion_key'))
  where metadata ? 'completion_key' and nullif(metadata->>'completion_key', '') is not null;

alter table public.mock_autopsies
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists trace_id uuid;

create unique index if not exists idx_mock_autopsies_user_idempotency
  on public.mock_autopsies(user_id, (metadata->>'idempotency_key'))
  where metadata ? 'idempotency_key';

alter table public.autopsy_questions
  add column if not exists evidence_status text not null default 'ignored_or_unverified',
  add column if not exists source_hash text,
  add column if not exists trace_id uuid;

alter table public.autopsy_questions
  drop constraint if exists autopsy_questions_evidence_status_check,
  add constraint autopsy_questions_evidence_status_check
    check (evidence_status in ('verified_mistake', 'needs_review', 'ignored_or_unverified', 'corrected_by_user'));

alter table public.mistakes
  drop constraint if exists mistakes_status_check;

alter table public.mistakes
  add constraint mistakes_status_check
    check (status in ('pending_review', 'verified_mistake', 'rejected', 'corrected_by_user'));

create index if not exists idx_autopsy_questions_verified
  on public.autopsy_questions(user_id, evidence_status, extraction_confidence desc)
  where evidence_status = 'verified_mistake';

create index if not exists idx_event_queue_polling
  on public.event_queue(status, next_attempt_at, created_at);

create index if not exists idx_consumer_locks_polling
  on public.consumer_locks(status, next_attempt_at, lease_expires_at, created_at);

alter table public.event_dlq
  add column if not exists attempts int default 0,
  add column if not exists last_attempt_at timestamptz;

alter table public.event_attempts
  add column if not exists event_id uuid,
  add column if not exists consumer_name text;

do $$
begin
  if exists (select 1 from pg_type where typname = 'event_status') then
    alter type event_status add value if not exists 'DLQ';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Atomic AI budget reservation
-- ---------------------------------------------------------------------------
alter table public.ai_usage_daily
  add column if not exists reserved_cost numeric not null default 0,
  add column if not exists reserved_tokens int not null default 0,
  add column if not exists committed_cost numeric not null default 0;

create table if not exists public.ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  feature text not null,
  model text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released', 'failed')),
  estimated_cost numeric not null default 0,
  estimated_tokens int not null default 0,
  actual_cost numeric,
  actual_tokens int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_budget_reservations_user_date
  on public.ai_budget_reservations(user_id, usage_date, status);

alter table public.ai_budget_reservations enable row level security;

drop policy if exists "Users view own ai_budget_reservations" on public.ai_budget_reservations;
create policy "Users view own ai_budget_reservations"
  on public.ai_budget_reservations for select
  using (auth.uid() = user_id);

alter table public.ai_usage_events
  add column if not exists reservation_id uuid references public.ai_budget_reservations(id) on delete set null;

create or replace function public.reserve_ai_budget(
  p_user_id uuid,
  p_feature text,
  p_model text,
  p_estimated_cost numeric,
  p_estimated_tokens int,
  p_daily_limit_usd numeric default 0.25
) returns uuid as $$
declare
  v_reserved_id uuid;
  v_usage public.ai_usage_daily%rowtype;
  v_estimated_cost numeric := greatest(coalesce(p_estimated_cost, 0), 0);
  v_estimated_tokens int := greatest(coalesce(p_estimated_tokens, 0), 0);
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  insert into public.ai_usage_daily(user_id, usage_date)
  values (p_user_id, current_date)
  on conflict (user_id, usage_date) do nothing;

  select * into v_usage
  from public.ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if coalesce(v_usage.estimated_cost, 0) + coalesce(v_usage.reserved_cost, 0) + v_estimated_cost > p_daily_limit_usd then
    update public.ai_usage_daily
    set budget_exceeded_count = coalesce(budget_exceeded_count, 0) + 1,
        updated_at = now()
    where id = v_usage.id;
    raise exception 'AI_DAILY_BUDGET_EXCEEDED';
  end if;

  insert into public.ai_budget_reservations (
    user_id,
    usage_date,
    feature,
    model,
    estimated_cost,
    estimated_tokens
  ) values (
    p_user_id,
    current_date,
    p_feature,
    coalesce(nullif(p_model, ''), 'unknown'),
    v_estimated_cost,
    v_estimated_tokens
  )
  returning id into v_reserved_id;

  update public.ai_usage_daily
  set reserved_cost = coalesce(reserved_cost, 0) + v_estimated_cost,
      reserved_tokens = coalesce(reserved_tokens, 0) + v_estimated_tokens,
      updated_at = now()
  where id = v_usage.id;

  return v_reserved_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

create or replace function public.commit_ai_usage(
  p_reservation_id uuid,
  p_actual_cost numeric,
  p_prompt_tokens int,
  p_completion_tokens int,
  p_route text default 'unknown'
) returns void as $$
declare
  v_reservation public.ai_budget_reservations%rowtype;
  v_prompt int := greatest(coalesce(p_prompt_tokens, 0), 0);
  v_completion int := greatest(coalesce(p_completion_tokens, 0), 0);
  v_total int := greatest(coalesce(p_prompt_tokens, 0), 0) + greatest(coalesce(p_completion_tokens, 0), 0);
  v_actual_cost numeric := greatest(coalesce(p_actual_cost, 0), 0);
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  select * into v_reservation
  from public.ai_budget_reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'AI_BUDGET_RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.status <> 'reserved' then
    return;
  end if;

  update public.ai_budget_reservations
  set status = 'committed',
      actual_cost = v_actual_cost,
      actual_tokens = v_total,
      updated_at = now()
  where id = p_reservation_id;

  update public.ai_usage_daily
  set reserved_cost = greatest(0, coalesce(reserved_cost, 0) - coalesce(v_reservation.estimated_cost, 0)),
      reserved_tokens = greatest(0, coalesce(reserved_tokens, 0) - coalesce(v_reservation.estimated_tokens, 0)),
      committed_cost = coalesce(committed_cost, 0) + v_actual_cost,
      estimated_cost = coalesce(estimated_cost, 0) + v_actual_cost,
      prompt_tokens = coalesce(prompt_tokens, 0) + v_prompt,
      completion_tokens = coalesce(completion_tokens, 0) + v_completion,
      total_tokens = coalesce(total_tokens, 0) + v_total,
      chat_calls = coalesce(chat_calls, 0) + case when v_reservation.feature = 'chat' then 1 else 0 end,
      autopsy_calls = coalesce(autopsy_calls, 0) + case when v_reservation.feature = 'autopsy' then 1 else 0 end,
      image_calls = coalesce(image_calls, 0) + case when v_reservation.feature = 'image' then 1 else 0 end,
      planner_calls = coalesce(planner_calls, 0) + case when v_reservation.feature = 'planner' then 1 else 0 end,
      session_card_calls = coalesce(session_card_calls, 0) + case when v_reservation.feature = 'session-card' then 1 else 0 end,
      updated_at = now()
  where user_id = v_reservation.user_id and usage_date = v_reservation.usage_date;

  insert into public.ai_usage_events (
    reservation_id,
    user_id,
    usage_date,
    feature,
    route,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost
  ) values (
    p_reservation_id,
    v_reservation.user_id,
    v_reservation.usage_date,
    v_reservation.feature,
    coalesce(nullif(p_route, ''), 'unknown'),
    v_reservation.model,
    v_prompt,
    v_completion,
    v_total,
    v_actual_cost
  );
end;
$$ language plpgsql volatile security definer set search_path = public;

create or replace function public.release_ai_budget(
  p_reservation_id uuid
) returns void as $$
declare
  v_reservation public.ai_budget_reservations%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized';
  end if;

  select * into v_reservation
  from public.ai_budget_reservations
  where id = p_reservation_id
  for update;

  if not found or v_reservation.status <> 'reserved' then
    return;
  end if;

  update public.ai_budget_reservations
  set status = 'released',
      updated_at = now()
  where id = p_reservation_id;

  update public.ai_usage_daily
  set reserved_cost = greatest(0, coalesce(reserved_cost, 0) - coalesce(v_reservation.estimated_cost, 0)),
      reserved_tokens = greatest(0, coalesce(reserved_tokens, 0) - coalesce(v_reservation.estimated_tokens, 0)),
      updated_at = now()
  where user_id = v_reservation.user_id and usage_date = v_reservation.usage_date;
end;
$$ language plpgsql volatile security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Security-definer hardening and transactional MVP RPCs
-- ---------------------------------------------------------------------------
create or replace function public.complete_study_session(
  p_user_id uuid,
  p_subject text,
  p_chapter text,
  p_topic text,
  p_concept_name text,
  p_duration_minutes int,
  p_understood boolean,
  p_gap_found text,
  p_cards_created int,
  p_session_type text,
  p_task_id uuid,
  p_concept_id uuid,
  p_completion_key text,
  p_source text
) returns jsonb as $$
declare
  v_session_id uuid;
  v_event_id uuid;
  v_existing record;
  v_profile record;
  v_started_at timestamptz;
  v_ended_at timestamptz := now();
  v_today date := current_date;
  v_last_active_date date;
  v_streak_days int := 0;
  v_streak_changed boolean := false;
  v_weight numeric;
  v_score numeric;
  v_new_mastery text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_completion_key is not null then
    select id, subject, chapter, metadata
    into v_existing
    from public.study_sessions
    where user_id = p_user_id
      and metadata->>'completion_key' = p_completion_key
    limit 1;

    if found then
      select coalesce(streak_days, 0) as streak_days
      into v_profile
      from public.profiles
      where id = p_user_id;

      return jsonb_build_object(
        'session_id', v_existing.id,
        'event_id', null,
        'concept_id', p_concept_id,
        'streak_days', coalesce(v_profile.streak_days, 0),
        'streak_changed', false,
        'idempotent_replay', true
      );
    end if;
  end if;

  select streak_days, last_active_at
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if p_task_id is not null then
    update public.study_tasks
    set is_completed = true,
        completed_at = coalesce(completed_at, v_ended_at)
    where id = p_task_id and user_id = p_user_id;

    if not found then
      raise exception 'study task not found or not owned by user';
    end if;
  end if;

  v_last_active_date := case
    when v_profile.last_active_at is null then null
    else v_profile.last_active_at::date
  end;
  v_streak_days := coalesce(v_profile.streak_days, 0);

  if v_last_active_date is distinct from v_today then
    v_streak_days := case
      when v_last_active_date = v_today - 1 then v_streak_days + 1
      else 1
    end;
    v_streak_changed := true;
  end if;

  update public.profiles
  set streak_days = v_streak_days,
      last_active_at = v_ended_at,
      learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at = v_ended_at
  where id = p_user_id;

  v_started_at := v_ended_at - (greatest(coalesce(p_duration_minutes, 1), 1) || ' minutes')::interval;

  insert into public.study_sessions (
    user_id,
    subject,
    chapter,
    topic,
    concept_name,
    started_at,
    ended_at,
    completed_at,
    duration_minutes,
    understood,
    gap_found,
    cards_created,
    session_type,
    is_completed,
    notes,
    metadata
  ) values (
    p_user_id,
    coalesce(nullif(p_subject, ''), 'General'),
    coalesce(nullif(p_chapter, ''), 'Session'),
    coalesce(nullif(p_topic, ''), coalesce(nullif(p_chapter, ''), 'Session')),
    coalesce(nullif(p_concept_name, ''), coalesce(nullif(p_chapter, ''), 'Session')),
    v_started_at,
    v_ended_at,
    v_ended_at,
    greatest(coalesce(p_duration_minutes, 1), 1),
    coalesce(p_understood, true),
    p_gap_found,
    coalesce(p_cards_created, 0),
    coalesce(nullif(p_session_type, ''), 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || coalesce(p_chapter, 'Session') || ' (' || coalesce(p_subject, 'General') || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', coalesce(p_source, 'complete_session'),
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'COMMAND_SESSION_COMPLETED',
    jsonb_build_object(
      'sessionId', v_session_id,
      'taskId', coalesce(p_task_id::text, 'session-' || v_session_id::text),
      'conceptId', p_concept_id,
      'conceptName', p_concept_name,
      'subject', p_subject,
      'chapter', p_chapter,
      'durationMinutes', p_duration_minutes,
      'understood', coalesce(p_understood, true),
      'gapFound', p_gap_found,
      'cardsCreated', coalesce(p_cards_created, 0),
      'understandingGained', coalesce(p_understood, true),
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, coalesce(p_source, 'complete_session') || ':' || v_session_id::text),
    coalesce(p_source, 'complete_session'),
    jsonb_build_object('source', coalesce(p_source, 'complete_session'))
  );

  if p_concept_id is not null then
    v_weight := case when coalesce(p_understood, true) then 6 else -8 end;

    insert into public.mastery_events (
      user_id,
      concept_id,
      old_mastery,
      new_mastery,
      source,
      source_id,
      source_event_id,
      evidence,
      evidence_type,
      weight,
      confidence
    )
    select
      p_user_id,
      p_concept_id,
      c.mastery,
      c.mastery,
      case when p_source = 'session_close' then 'session_close' else 'tutor_session' end,
      v_session_id::text,
      v_event_id,
      case when coalesce(p_understood, true)
        then 'Completed session on ' || coalesce(p_chapter, 'Session')
        else 'Session on ' || coalesce(p_chapter, 'Session') || ' surfaced gap' || coalesce(': ' || p_gap_found, '')
      end,
      case when coalesce(p_understood, true) then 'tutor_understood' else 'tutor_confused' end,
      v_weight,
      0.9
    from public.concepts c
    where c.id = p_concept_id and c.user_id = p_user_id
    on conflict do nothing;

    select coalesce(sum(coalesce(weight, 0)), 0)
    into v_score
    from public.mastery_events
    where user_id = p_user_id and concept_id = p_concept_id;

    v_score := case when v_score < 0 then 12 else least(100, v_score) end;
    v_new_mastery := case
      when v_score >= 95 then 'automated'
      when v_score >= 85 then 'mastered'
      when v_score >= 60 then 'proficient'
      when v_score >= 25 then 'developing'
      when v_score > 0 then 'exposed'
      else 'not_started'
    end;

    update public.concepts
    set mastery = v_new_mastery,
        mastery_score = v_score,
        confidence = case when v_score >= 60 then 'medium' else 'low' end,
        last_reviewed_at = v_ended_at,
        updated_at = v_ended_at
    where id = p_concept_id and user_id = p_user_id;
  end if;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id,
    'concept_id', p_concept_id,
    'streak_days', v_streak_days,
    'streak_changed', v_streak_changed,
    'idempotent_replay', false
  );
end;
$$ language plpgsql volatile security definer set search_path = public;

create or replace function public.ingest_mock_autopsy(
  p_user_id uuid,
  p_test_name text,
  p_exam_type text,
  p_total_questions int,
  p_correct_count int,
  p_incorrect_count int,
  p_unattempted_count int,
  p_current_score numeric,
  p_recoverable_marks numeric,
  p_potential_score numeric,
  p_questions jsonb,
  p_idempotency_key text,
  p_trace_id uuid,
  p_confidence_threshold numeric default 70
) returns jsonb as $$
declare
  v_autopsy_id uuid;
  v_event_id uuid;
  v_existing record;
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'autopsy idempotency key required';
  end if;

  select id, metadata->>'event_id' as event_id
  into v_existing
  from public.mock_autopsies
  where user_id = p_user_id
    and metadata->>'idempotency_key' = p_idempotency_key
  limit 1;

  if found then
    return jsonb_build_object(
      'autopsy_id', v_existing.id,
      'event_id', v_existing.event_id,
      'idempotent_replay', true
    );
  end if;

  insert into public.mock_autopsies (
    user_id,
    test_name,
    exam_type,
    total_questions,
    correct_count,
    incorrect_count,
    unattempted_count,
    current_score,
    recoverable_marks,
    potential_score,
    status,
    metadata,
    trace_id
  ) values (
    p_user_id,
    coalesce(nullif(p_test_name, ''), 'Mock Test Autopsy'),
    coalesce(nullif(p_exam_type, ''), 'General Study'),
    greatest(coalesce(p_total_questions, 0), 0),
    greatest(coalesce(p_correct_count, 0), 0),
    greatest(coalesce(p_incorrect_count, 0), 0),
    greatest(coalesce(p_unattempted_count, 0), 0),
    coalesce(p_current_score, 0),
    coalesce(p_recoverable_marks, 0),
    coalesce(p_potential_score, 0),
    'processing',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'confidence_threshold', p_confidence_threshold
    ),
    p_trace_id
  ) returning id into v_autopsy_id;

  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce((v_question->>'questionNumber')::int, (v_question->>'question_number')::int);
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );
    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false) or v_confidence < p_confidence_threshold;
    v_evidence_status := case
      when v_needs_review then 'needs_review'
      when v_status = 'Incorrect' then 'verified_mistake'
      else 'ignored_or_unverified'
    end;
    v_source_hash := md5(v_autopsy_id::text || ':' || coalesce(v_question_number::text, '') || ':' || coalesce(v_question->>'questionText', '') || ':' || coalesce(v_question->>'correctAnswer', ''));

    insert into public.autopsy_questions (
      autopsy_id,
      user_id,
      question_number,
      subject,
      chapter,
      subtopic,
      difficulty,
      status,
      question_text,
      correct_answer,
      student_answer,
      mistake_category,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      source_hash,
      trace_id,
      trace_metadata
    ) values (
      v_autopsy_id,
      p_user_id,
      v_question_number,
      v_question->>'subject',
      v_question->>'chapter',
      v_question->>'subtopic',
      v_question->>'difficulty',
      v_status,
      v_question->>'questionText',
      v_question->>'correctAnswer',
      v_question->>'studentAnswer',
      v_question->>'mistakeCategory',
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id', p_trace_id,
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review', v_needs_review,
        'source_autopsy_id', v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
    set extraction_confidence = excluded.extraction_confidence
    returning id into v_question_id;

    if v_evidence_status = 'verified_mistake' then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        concept_id,
        category,
        status,
        subject,
        chapter,
        topic,
        question_text,
        user_answer,
        correct_answer,
        marks_lost,
        total_marks,
        ai_analysis,
        improvement_suggestion,
        source_autopsy_id,
        source_question_number,
        extraction_confidence
      ) values (
        p_user_id,
        v_autopsy_id,
        null,
        coalesce(nullif(v_question->>'mistakeCategory', ''), 'unknown'),
        'verified_mistake',
        v_question->>'subject',
        v_question->>'chapter',
        coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
        v_question->>'questionText',
        v_question->>'studentAnswer',
        v_question->>'correctAnswer',
        coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
        coalesce(nullif(v_question->>'totalMarks', '')::numeric, 0),
        v_question->>'reasoning',
        coalesce(v_question->>'correctExplanation', v_question->>'conceptualGap'),
        v_autopsy_id,
        v_question_number,
        v_confidence
      )
      on conflict (user_id, source_autopsy_id, source_question_number) where source_autopsy_id is not null and source_question_number is not null
      do nothing;

      v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
        'questionNumber', v_question_number,
        'subject', v_question->>'subject',
        'chapter', v_question->>'chapter',
        'mistakeCategory', v_question->>'mistakeCategory',
        'reasoning', v_question->>'reasoning',
        'correctExplanation', v_question->>'correctExplanation',
        'conceptualGap', v_question->>'conceptualGap',
        'status', 'verified_mistake',
        'extraction_confidence', v_confidence,
        'extractionConfidence', v_confidence,
        'needs_review', false,
        'needsReview', false,
        'source_question_id', v_question_id,
        'sourceQuestionId', v_question_id,
        'source_autopsy_id', v_autopsy_id,
        'sourceAutopsyId', v_autopsy_id,
        'trace_id', p_trace_id
      ));
    end if;
  end loop;

  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId', v_autopsy_id,
      'testName', p_test_name,
      'examType', p_exam_type,
      'rawScore', p_current_score,
      'recoverableScore', coalesce(p_current_score, 0) + coalesce(p_recoverable_marks, 0),
      'potentialScore', p_potential_score,
      'totalQuestions', p_total_questions,
      'correctCount', p_correct_count,
      'incorrectCount', p_incorrect_count,
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source', 'autopsy_engine',
      'autopsyId', v_autopsy_id,
      'trace_id', p_trace_id,
      'wrongQuestions', v_wrong_questions
    )
  );

  update public.mock_autopsies
  set status = 'completed',
      completed_at = now(),
      metadata = metadata || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id', v_autopsy_id,
    'event_id', v_event_id,
    'idempotent_replay', false
  );
exception when others then
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;

create or replace function public.ingest_autopsy_document(
  p_user_id uuid,
  p_filename text,
  p_file_url text,
  p_file_type text,
  p_mime_type text,
  p_size_bytes bigint,
  p_metadata jsonb
) returns uuid as $$
declare
  v_document_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  insert into public.documents (
    user_id,
    filename,
    file_url,
    file_type,
    mime_type,
    size_bytes,
    status,
    metadata
  ) values (
    p_user_id,
    p_filename,
    p_file_url,
    p_file_type,
    p_mime_type,
    p_size_bytes,
    'pending',
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_document_id;

  return v_document_id;
end;
$$ language plpgsql volatile security definer set search_path = public;

revoke execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) from public, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) to service_role;

revoke execute on function public.acquire_event_leases(text, int, interval) from public, authenticated;
grant execute on function public.acquire_event_leases(text, int, interval) to service_role;

revoke execute on function public.reserve_ai_budget(uuid, text, text, numeric, int, numeric) from public, authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, text, numeric, int, numeric) to service_role;

revoke execute on function public.commit_ai_usage(uuid, numeric, int, int, text) from public, authenticated;
grant execute on function public.commit_ai_usage(uuid, numeric, int, int, text) to service_role;

revoke execute on function public.release_ai_budget(uuid) from public, authenticated;
grant execute on function public.release_ai_budget(uuid) to service_role;

revoke execute on function public.complete_study_session(uuid, text, text, text, text, int, boolean, text, int, text, uuid, uuid, text, text) from public;
grant execute on function public.complete_study_session(uuid, text, text, text, text, int, boolean, text, int, text, uuid, uuid, text, text) to authenticated;

revoke execute on function public.ingest_mock_autopsy(uuid, text, text, int, int, int, int, numeric, numeric, numeric, jsonb, text, uuid, numeric) from public;
grant execute on function public.ingest_mock_autopsy(uuid, text, text, int, int, int, int, numeric, numeric, numeric, jsonb, text, uuid, numeric) to authenticated;

revoke execute on function public.ingest_autopsy_document(uuid, text, text, text, text, bigint, jsonb) from public;
grant execute on function public.ingest_autopsy_document(uuid, text, text, text, text, bigint, jsonb) to authenticated;
