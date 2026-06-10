-- Migration: fix_event_routing_matrix.sql
-- Removes stale command-engine and updates the routing matrix to only include active consumers.

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
    when 'CHAT_MESSAGE_CREATED' then array['chat_side_effect_engine', 'mind_agent']
    when 'CHAT_LEARNING_SIGNAL' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent']
    when 'CHAT_SESSION_SUMMARIZE' then array['chat_side_effect_engine']
    when 'MATERIAL_UPLOADED' then array['rag_agent']
    when 'MATERIAL_INGESTION_REQUESTED' then array['rag_agent']
    when 'MATERIAL_INGESTED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'RAG_QUERY_USED' then array['mind_agent']
    when 'RAG_CARD_CANDIDATE_CREATED' then array['memory_agent']
    when 'MIND_ACTION_REQUESTED' then array['mind_agent']
    when 'MIND_CONTEXT_REFRESHED' then array['mind_agent']
    when 'AUTOPSY_UPLOAD_RECEIVED' then array['autopsy_engine']
    when 'MOCK_TEST_UPLOADED' then array['autopsy_engine']
    when 'AUTOPSY_PROCESSING_COMPLETED' then array['autopsy_agent', 'planner_agent']
    when 'TEST_ANALYSIS_COMPLETED' then array['autopsy_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_EXTRACTED' then array['autopsy_agent']
    when 'AUTOPSY_MISTAKE_APPROVED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'AUTOPSY_MISTAKE_REJECTED' then array['autopsy_agent']
    when 'AUTOPSY_MOCK_PROCESSED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MOCK_TEST_ANALYZED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'AUTOPSY_V3_ASSESSMENT_CREATED' then array['autopsy_agent']
    when 'AUTOPSY_V3_QUESTIONS_UPSERTED' then array['autopsy_agent']
    when 'AUTOPSY_V3_REASONS_COLLECTED' then array['autopsy_agent', 'hermes_worker', 'learning_state_engine']
    when 'AUTOPSY_V3_REPORT_READY' then array['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'hermes_worker']
    when 'HERMES_MEMORY_UPDATED' then array['memory_agent', 'planner_agent']
    when 'LEARNING_SIGNAL_INGESTED' then array['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'STUDY_SESSION_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MIND_TUTOR_COMPLETED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'MEMORY_CARD_REVIEWED' then array['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent']
    when 'REVISION_CARD_REVIEWED' then array['memory_agent', 'atlas_agent', 'planner_agent']
    when 'REVISION_COMPLETED' then array['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent']
    when 'MEMORY_CARD_CREATE_REQUESTED' then array['memory_agent']
    when 'ATLAS_MASTERY_UPDATED' then array['learning_state_engine', 'command_agent', 'planner_agent']
    when 'ATLAS_MASTERY_UPDATE_REQUESTED' then array['atlas_agent']
    when 'MEMORY_CARD_CREATED' then array['learning_state_engine', 'command_agent', 'planner_agent']
    when 'CONCEPT_DISCOVERED' then array['concept_expansion_engine']
    when 'INGESTION_DOCUMENT_PROCESSED' then array['learning_state_engine']
    when 'MIND_MESSAGE_CREATED' then array['learning_state_engine']
    when 'SESSION_CARD_COMPLETED' then array['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    when 'SESSION_RECOMMENDATION_REQUESTED' then array['planner_agent']
    when 'SESSION_RECOMMENDATION_CREATED' then array['mind_agent']
    when 'LEARNER_STATE_CHANGED' then array['planner_agent', 'mind_agent']
    when 'PLANNER_REPLAN_REQUESTED' then array['planner_agent', 'command_agent']
    when 'STUDENT_MODEL_SYNC_REQUESTED' then array['learning_state_engine']
    when 'PRACTICE_ATTEMPT_RECORDED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'PRACTICE_ATTEMPT_SUBMITTED' then array['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    when 'ONBOARDING_QUIZ_COMPLETE' then array['learning_state_engine', 'planner_agent', 'command_agent']
    when 'HERMES_MISTAKE_REVIEW_REQUESTED' then array['hermes_worker']
    when 'HERMES_SOURCE_PROCESS_REQUESTED' then array['hermes_worker']
    when 'HERMES_REVISION_QUALITY_REQUESTED' then array['hermes_worker']
    when 'HERMES_TRACE_REQUESTED' then array['hermes_worker']
    when 'HERMES_NEXT_ACTION_REQUESTED' then array['hermes_worker']
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
