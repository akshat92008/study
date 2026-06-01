-- Migration: 20260601082500_fix_streak_rpc_auth_and_version.sql
-- Purpose: Add security check and learner_state_version bump to complete_study_session.

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
  v_current_streak int;
  v_last_active_at timestamptz;
  v_new_streak int;
  v_streak_changed boolean := false;
  v_today date := current_date;
  v_last_active_date date;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    if current_setting('request.jwt.claim.role', true) <> 'service_role' then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- Get current streak
  select streak_days, last_active_at into v_current_streak, v_last_active_at
  from public.profiles
  where id = p_user_id
  for update;
  
  v_current_streak := coalesce(v_current_streak, 0);
  v_last_active_date := v_last_active_at::date;
  
  if v_last_active_date = v_today then
    -- Already active today
    v_new_streak := greatest(v_current_streak, 1);
  elsif v_last_active_date = v_today - interval '1 day' then
    -- Active yesterday
    v_new_streak := v_current_streak + 1;
    v_streak_changed := true;
  else
    -- Gap or new
    v_new_streak := 1;
    v_streak_changed := true;
  end if;

  -- Update profile
  update public.profiles
  set streak_days = v_new_streak,
      last_active_at = now(),
      updated_at = now(),
      learner_state_version = coalesce(learner_state_version, 0) + 1
  where id = p_user_id;

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
    'STUDY_SESSION_COMPLETED',
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
    'event_id', v_event_id,
    'streak_days', v_new_streak,
    'streak_changed', v_streak_changed
  );
end;
$$ language plpgsql security definer set search_path = public;
