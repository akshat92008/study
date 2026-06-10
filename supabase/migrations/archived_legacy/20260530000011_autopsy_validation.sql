-- Migration: 20260530000011_autopsy_validation.sql
-- Purpose: Prevent malicious students from spoofing autopsy scores by recalculating them securely in Postgres
-- and restricting execution to the service_role (requiring AI analysis on backend).

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
  v_wrong_questions jsonb := '[]'::jsonb;
  v_source_hash text;
  
  -- Validation variables
  v_computed_correct_count int := 0;
  v_computed_incorrect_count int := 0;
  v_computed_unattempted_count int := 0;
  v_computed_score numeric := 0;
  v_computed_potential numeric := 0;
  v_computed_recoverable numeric := 0;
  v_total_marks numeric;
  v_marks_lost numeric;
begin
  -- ONLY allow service_role to prevent client-side spoofing bypassing AI extraction
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'unauthorized: mock autopsies must be processed via the backend AI engine';
  end if;

  -- 1. Securely compute aggregates directly from the questions array
  for v_question in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    v_status := coalesce(v_question->>'status', 'Unattempted');
    v_total_marks := coalesce((v_question->>'totalMarks')::numeric, 4);
    v_marks_lost := coalesce((v_question->>'marksLost')::numeric, 0);

    v_computed_potential := v_computed_potential + v_total_marks;
    v_computed_score := v_computed_score + (v_total_marks - v_marks_lost);

    if v_status = 'Correct' then
      v_computed_correct_count := v_computed_correct_count + 1;
    elsif v_status = 'Incorrect' then
      v_computed_incorrect_count := v_computed_incorrect_count + 1;
      -- If mistake category is recoverable
      if v_question->>'mistakeCategory' in ('silly_mistake', 'time_pressure', 'misread_question', 'recall_failure') then
         v_computed_recoverable := v_computed_recoverable + v_marks_lost;
      end if;
    else
      v_computed_unattempted_count := v_computed_unattempted_count + 1;
    end if;
  end loop;

  -- 2. Insert using computed values, ignoring client-provided aggregates
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

  -- 3. Process questions
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
      when v_status = 'Incorrect' then 'pending_review'
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

    if v_evidence_status = 'pending_review' or v_evidence_status = 'verified_mistake' then
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
        v_evidence_status,
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
        'status', v_evidence_status,
        'extraction_confidence', v_confidence,
        'extractionConfidence', v_confidence,
        'needs_review', v_needs_review,
        'needsReview', v_needs_review,
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
      'rawScore', v_computed_score,
      'recoverableScore', coalesce(v_computed_score, 0) + coalesce(v_computed_recoverable, 0),
      'potentialScore', v_computed_potential,
      'totalQuestions', jsonb_array_length(coalesce(p_questions, '[]'::jsonb)),
      'correctCount', v_computed_correct_count,
      'incorrectCount', v_computed_incorrect_count,
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
