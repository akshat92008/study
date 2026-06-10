-- ============================================================================
-- AUTOPSY HARDENING: Evidence Contract & Mistake Tracking
-- ============================================================================

-- Add missing columns to autopsy_questions safely
alter table public.autopsy_questions
  add column if not exists evidence_status text default 'pending_review',
  add column if not exists mistake_type text,
  add column if not exists confidence numeric default 0 check (confidence >= 0 and confidence <= 1),
  add column if not exists concept_id uuid references public.concepts(id) on delete set null,
  add column if not exists concept_name text,
  add column if not exists student_answer text,
  add column if not exists correct_answer text,
  add column if not exists explanation text,
  add column if not exists evidence_source text default 'autopsy',
  add column if not exists raw_evidence jsonb default '{}'::jsonb,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
-- Add constraints to autopsy_questions (using DO block to catch if already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'autopsy_questions_evidence_status_check'
  ) then
    alter table public.autopsy_questions add constraint autopsy_questions_evidence_status_check 
      check (evidence_status in ('verified_mistake', 'verified_correct', 'needs_review', 'pending_review', 'ignored', 'corrected_by_user', 'ignored_or_unverified'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'autopsy_questions_mistake_type_check'
  ) then
    alter table public.autopsy_questions add constraint autopsy_questions_mistake_type_check 
      check (mistake_type in ('conceptual_gap', 'formula_recall', 'calculation_error', 'misread_question', 'option_trap', 'silly_mistake', 'time_pressure', 'forgot_fact', 'application_failure', 'low_confidence_guess', 'unattempted', 'ambiguous', 'out_of_syllabus', 'unknown'));
  end if;
end $$;
-- Indexes for autopsy_questions
create index if not exists idx_autopsy_questions_user_evidence_status on public.autopsy_questions(user_id, evidence_status);
create index if not exists idx_autopsy_questions_user_concept_id on public.autopsy_questions(user_id, concept_id);
-- Add missing columns to mistakes safely
alter table public.mistakes
  add column if not exists autopsy_question_id uuid references public.autopsy_questions(id) on delete set null,
  add column if not exists mistake_type text,
  add column if not exists confidence numeric default 1 check (confidence >= 0 and confidence <= 1),
  add column if not exists evidence_source text default 'autopsy',
  add column if not exists source text default 'autopsy',
  add column if not exists raw_evidence jsonb default '{}'::jsonb;
-- Add constraints to mistakes (using DO block to catch if already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'mistakes_mistake_type_check'
  ) then
    alter table public.mistakes add constraint mistakes_mistake_type_check 
      check (mistake_type in ('conceptual_gap', 'formula_recall', 'calculation_error', 'misread_question', 'option_trap', 'silly_mistake', 'time_pressure', 'forgot_fact', 'application_failure', 'low_confidence_guess', 'unattempted', 'ambiguous', 'out_of_syllabus', 'unknown'));
  end if;
end $$;
-- Indexes for mistakes
create index if not exists idx_mistakes_user_concept on public.mistakes(user_id, concept_id);
create index if not exists idx_mistakes_user_created_desc on public.mistakes(user_id, created_at desc);
-- RLS check
alter table public.autopsy_questions enable row level security;
alter table public.mistakes enable row level security;
-- ============================================================================
-- OVERRIDE INGEST MOCK AUTOPSY RPC
-- ============================================================================

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
  v_question jsonb;
  v_question_id uuid;
  v_question_number int;
  v_status text;
  v_confidence numeric;
  v_needs_review boolean;
  v_evidence_status text;
  v_mistake_type text;
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;

  -- Idempotency guard
  v_existing_autopsy_id uuid;
  v_existing_metadata jsonb;

  -- Secure server-side recompute variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  -- ─── IDEMPOTENCY GUARD ────────────────────────────────────────────────────
  if p_idempotency_key is not null then
    select id, metadata into v_existing_autopsy_id, v_existing_metadata
    from public.mock_autopsies
    where idempotency_key = p_idempotency_key
    limit 1;

    if v_existing_autopsy_id is not null then
      return jsonb_build_object(
        'autopsy_id', v_existing_autopsy_id,
        'event_id',   coalesce(v_existing_metadata->>'event_id', null),
        'idempotent_replay', true
      );
    end if;
  end if;

  -- ─── STEP 1: Securely recompute aggregates from questions array ───────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost  := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score     := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      if coalesce(v_question->>'mistakeType', v_question->>'mistakeCategory') in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
        v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- ─── STEP 2: Insert mock_autopsies row ───────────────────────────────────
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
    idempotency_key,
    trace_id
  ) values (
    p_user_id,
    p_test_name,
    p_exam_type,
    jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
    v_computed_correct_count,
    v_computed_incorrect_count,
    v_computed_unattempted_count,
    v_computed_score,
    v_computed_recoverable,
    v_computed_potential,
    'processing',
    p_idempotency_key,
    p_trace_id
  ) returning id into v_autopsy_id;

  -- ─── STEP 3: Process each question ───────────────────────────────────────
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_question_number := coalesce(
      nullif(v_question->>'questionNumber', '')::int,
      nullif(v_question->>'question_number', '')::int
    );
    v_status := coalesce(v_question->>'status', 'Unattempted');

    v_confidence := coalesce(
      nullif(v_question->>'extractionConfidence', '')::numeric,
      nullif(v_question->>'ocrConfidence', '')::numeric,
      100
    );

    v_needs_review := coalesce((v_question->>'needsReview')::boolean, false)
                      or v_confidence < p_confidence_threshold;

    v_evidence_status := coalesce(v_question->>'evidenceStatus', v_question->>'evidence_status');
    if v_evidence_status is null then
      v_evidence_status := case
        when v_needs_review                                                     then 'needs_review'
        when v_status = 'Incorrect' and v_confidence >= p_confidence_threshold  then 'verified_mistake'
        when v_status = 'Incorrect'                                              then 'pending_review'
        else                                                                          'ignored_or_unverified'
      end;
    end if;

    v_mistake_type := coalesce(v_question->>'mistakeType', v_question->>'mistakeCategory');
    if v_mistake_type not in ('conceptual_gap', 'formula_recall', 'calculation_error', 'misread_question', 'option_trap', 'silly_mistake', 'time_pressure', 'forgot_fact', 'application_failure', 'low_confidence_guess', 'unattempted', 'ambiguous', 'out_of_syllabus', 'unknown') then
      v_mistake_type := 'unknown';
    end if;

    v_source_hash := md5(
      v_autopsy_id::text || ':' ||
      coalesce(v_question_number::text, '') || ':' ||
      coalesce(v_question->>'questionText', '') || ':' ||
      coalesce(v_question->>'correctAnswer', '')
    );

    -- ─── Insert autopsy_questions row (upsert on conflict) ─────────────────
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
      mistake_type,
      concept_name,
      reasoning,
      marks_lost,
      needs_review,
      ocr_confidence,
      extraction_confidence,
      evidence_status,
      confidence,
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
      v_mistake_type,
      v_mistake_type,
      coalesce(v_question->>'conceptualGap', v_question->>'subtopic'),
      v_question->>'reasoning',
      coalesce(nullif(v_question->>'marksLost', '')::numeric, 0),
      v_needs_review,
      v_confidence,
      v_confidence,
      v_evidence_status,
      greatest(0, least(1, v_confidence / 100)),
      v_source_hash,
      p_trace_id,
      jsonb_build_object(
        'trace_id',            p_trace_id,
        'status',              v_evidence_status,
        'extraction_confidence', v_confidence,
        'needs_review',        v_needs_review,
        'source_autopsy_id',   v_autopsy_id
      )
    )
    on conflict (autopsy_id, question_number) do update
      set extraction_confidence = excluded.extraction_confidence,
          evidence_status       = excluded.evidence_status,
          mistake_type          = excluded.mistake_type,
          concept_name          = excluded.concept_name,
          updated_at            = now()
    returning id into v_question_id;

    if v_evidence_status in ('pending_review', 'verified_mistake') then
      insert into public.mistakes (
        user_id,
        autopsy_id,
        autopsy_question_id,
        concept_id,
        category,
        mistake_type,
        status,
        evidence_status,
        confidence,
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
        v_question_id,
        null,
        v_mistake_type::mistake_category,
        v_mistake_type,
        v_evidence_status,
        v_evidence_status,
        greatest(0, least(1, v_confidence / 100)),
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
      on conflict (user_id, source_autopsy_id, source_question_number)
        where source_autopsy_id is not null and source_question_number is not null
      do nothing;

      if v_evidence_status = 'verified_mistake' then
        v_wrong_questions := v_wrong_questions || jsonb_build_array(jsonb_build_object(
          'questionNumber',      v_question_number,
          'subject',             v_question->>'subject',
          'chapter',             v_question->>'chapter',
          'mistakeCategory',     v_mistake_type,
          'mistakeType',         v_mistake_type,
          'reasoning',           v_question->>'reasoning',
          'correctExplanation',  v_question->>'correctExplanation',
          'conceptualGap',       v_question->>'conceptualGap',
          'status',              v_evidence_status,
          'evidence_status',     v_evidence_status,
          'evidenceStatus',      v_evidence_status,
          'extraction_confidence', v_confidence,
          'extractionConfidence',  v_confidence,
          'needs_review',        false,
          'needsReview',         false,
          'source_question_id',  v_question_id,
          'sourceQuestionId',    v_question_id,
          'source_autopsy_id',   v_autopsy_id,
          'sourceAutopsyId',     v_autopsy_id,
          'trace_id',            p_trace_id
        ));
      end if;
    end if;
  end loop;

  -- ─── STEP 4: Publish AUTOPSY_MOCK_PROCESSED event transactionally ────────
  v_event_id := public.create_event_with_consumers(
    p_user_id,
    'AUTOPSY_MOCK_PROCESSED',
    jsonb_build_object(
      'autopsyId',        v_autopsy_id,
      'testName',         p_test_name,
      'examType',         p_exam_type,
      'rawScore',         v_computed_score,
      'recoverableScore', v_computed_score + v_computed_recoverable,
      'potentialScore',   v_computed_potential,
      'totalQuestions',   jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount',     v_computed_correct_count,
      'incorrectCount',   v_computed_incorrect_count,
      'verifiedCount',    jsonb_array_length(v_wrong_questions),
      'pendingReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'pending_review'
      ),
      'needsReviewCount', (
        select count(*) from public.autopsy_questions
        where autopsy_id = v_autopsy_id
          and evidence_status = 'needs_review'
      )
    ),
    'autopsy:' || v_autopsy_id::text || ':processed',
    'autopsy_engine',
    jsonb_build_object(
      'source',          'autopsy_engine',
      'autopsyId',       v_autopsy_id,
      'trace_id',        p_trace_id,
      'wrongQuestions',  v_wrong_questions
    )
  );

  -- ─── STEP 5: Mark autopsy as completed ───────────────────────────────────
  update public.mock_autopsies
  set status       = 'completed',
      completed_at = now(),
      metadata     = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('event_id', v_event_id)
  where id = v_autopsy_id;

  delete from public.session_cards
  where user_id = p_user_id
    and date in (current_date, current_date + 1);

  update public.profiles
  set learner_state_version = coalesce(learner_state_version, 0) + 1,
      updated_at            = now()
  where id = p_user_id;

  return jsonb_build_object(
    'autopsy_id',        v_autopsy_id,
    'event_id',          v_event_id,
    'idempotent_replay', false,
    'verified_count',    jsonb_array_length(v_wrong_questions),
    'pending_review_count', (
      select count(*) from public.autopsy_questions
      where autopsy_id = v_autopsy_id and evidence_status = 'pending_review'
    )
  );

exception when others then
  if v_autopsy_id is not null then
    update public.mock_autopsies
    set status        = 'failed',
        error_message = sqlerrm
    where id = v_autopsy_id;
  end if;
  raise;
end;
$$ language plpgsql volatile security definer set search_path = public;
revoke execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) from public, authenticated, service_role;
grant execute on function public.ingest_mock_autopsy(
  uuid, text, text, int, int, int, int, numeric, numeric, numeric,
  jsonb, text, uuid, numeric
) to authenticated;
