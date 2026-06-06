-- Migration: 20260530000004_rpc_transactions.sql
-- Purpose: Provide strict transactional boundaries for study session completion and autopsy ingestion

-- 0. Add status to mistakes for confidence gating
alter table public.mistakes
  add column if not exists status text default 'pending_review' check (status in ('pending_review', 'verified_mistake', 'rejected'));
-- 1. Study Session Completion RPC

-- 1. Study Session Completion RPC
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
  v_ended_at timestamptz := now();
  v_started_at timestamptz := now() - (p_duration_minutes || ' minutes')::interval;
begin
  -- Insert study session
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
    p_subject,
    p_chapter,
    p_topic,
    p_concept_name,
    v_started_at,
    v_ended_at,
    v_ended_at,
    p_duration_minutes,
    p_understood,
    p_gap_found,
    p_cards_created,
    coalesce(p_session_type, 'study'),
    true,
    case when p_gap_found is not null then 'Gap identified: ' || p_gap_found else 'Studied ' || p_chapter || ' (' || p_subject || ')' end,
    jsonb_build_object(
      'completion_key', p_completion_key,
      'source', p_source,
      'taskId', p_task_id,
      'conceptId', p_concept_id
    )
  ) returning id into v_session_id;

  -- Create event atomically
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
      'understood', p_understood,
      'gapFound', p_gap_found,
      'cardsCreated', p_cards_created,
      'understandingGained', p_understood,
      'isSessionComplete', true,
      'masteryEvidenceRecorded', p_concept_id is not null
    ),
    coalesce(p_completion_key, p_source || ':' || v_session_id::text),
    p_source,
    jsonb_build_object('source', p_source)
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'event_id', v_event_id
  );
end;
$$ language plpgsql security definer set search_path = public;
-- 2. Autopsy Ingestion RPC
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
$$ language plpgsql security definer set search_path = public;
