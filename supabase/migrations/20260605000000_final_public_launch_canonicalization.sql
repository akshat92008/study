-- 20260605_final_public_launch_canonicalization.sql

-- 1. Patch learning_signals check constraint
ALTER TABLE public.learning_signals DROP CONSTRAINT IF EXISTS learning_signals_signal_type_check;
ALTER TABLE public.learning_signals ADD CONSTRAINT learning_signals_signal_type_check CHECK (signal_type IN (
  'assessment_result', 'question_mistake', 'manual_mistake', 'chat_confusion',
  'revision_review', 'practice_attempt', 'source_upload', 'self_reflection',
  'task_completion', 'autopsy_memory_created'
));

-- 2. Add and confirm indexes
CREATE INDEX IF NOT EXISTS event_queue_user_status_created_idx ON public.event_queue(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS event_queue_status_next_attempt_idx ON public.event_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS consumer_locks_status_next_attempt_idx ON public.consumer_locks(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS consumer_locks_event_consumer_idx ON public.consumer_locks(event_id, consumer_name);
CREATE INDEX IF NOT EXISTS autopsy_reports_user_assessment_idx ON public.autopsy_reports(user_id, assessment_id);
CREATE INDEX IF NOT EXISTS assessment_questions_user_assessment_idx ON public.assessment_questions(user_id, assessment_id);
CREATE INDEX IF NOT EXISTS learning_signals_user_type_created_idx ON public.learning_signals(user_id, signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS hermes_learning_memories_user_status_last_seen_idx ON public.hermes_learning_memories(user_id, status, last_seen_at DESC);

-- 3. Patch event routing RPC to match EVENT_CONSUMER_MATRIX exactly
CREATE OR REPLACE FUNCTION public.create_event_with_consumers(
  p_user_id uuid,
  p_type text,
  p_data jsonb,
  p_idempotency_key text,
  p_source text,
  p_metadata jsonb
) RETURNS uuid AS $$
DECLARE
  v_event_id uuid;
  v_consumers text[];
BEGIN
  v_consumers := CASE p_type
    WHEN 'CHAT_MESSAGE_PROCESSED' THEN ARRAY['chat_side_effect_engine', 'mind_agent']
    WHEN 'CHAT_MESSAGE_CREATED' THEN ARRAY['chat_side_effect_engine', 'mind_agent']
    WHEN 'CHAT_LEARNING_SIGNAL' THEN ARRAY['learning_state_engine', 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent']
    WHEN 'CHAT_SESSION_SUMMARIZE' THEN ARRAY['chat_side_effect_engine']
    WHEN 'MATERIAL_UPLOADED' THEN ARRAY['rag_agent']
    WHEN 'MATERIAL_INGESTION_REQUESTED' THEN ARRAY['rag_agent']
    WHEN 'MATERIAL_INGESTED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'RAG_QUERY_USED' THEN ARRAY['mind_agent']
    WHEN 'RAG_CARD_CANDIDATE_CREATED' THEN ARRAY['memory_agent']
    WHEN 'MIND_ACTION_REQUESTED' THEN ARRAY['mind_agent']
    WHEN 'MIND_CONTEXT_REFRESHED' THEN ARRAY['mind_agent']
    WHEN 'AUTOPSY_UPLOAD_RECEIVED' THEN ARRAY['autopsy_engine']
    WHEN 'MOCK_TEST_UPLOADED' THEN ARRAY['autopsy_engine']
    WHEN 'AUTOPSY_PROCESSING_COMPLETED' THEN ARRAY['autopsy_agent', 'planner_agent']
    WHEN 'TEST_ANALYSIS_COMPLETED' THEN ARRAY['autopsy_agent', 'planner_agent', 'command_agent']
    WHEN 'AUTOPSY_MISTAKE_EXTRACTED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_MISTAKE_APPROVED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'AUTOPSY_MISTAKE_REJECTED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_MOCK_PROCESSED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'MOCK_TEST_ANALYZED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'AUTOPSY_V3_ASSESSMENT_CREATED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_V3_QUESTIONS_UPSERTED' THEN ARRAY['autopsy_agent']
    WHEN 'AUTOPSY_V3_REASONS_COLLECTED' THEN ARRAY['autopsy_agent', 'hermes_worker', 'learning_state_engine']
    WHEN 'AUTOPSY_V3_REPORT_READY' THEN ARRAY['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'hermes_worker']
    WHEN 'HERMES_MEMORY_UPDATED' THEN ARRAY['memory_agent', 'planner_agent']
    WHEN 'LEARNING_SIGNAL_INGESTED' THEN ARRAY['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'STUDY_SESSION_COMPLETED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'MIND_TUTOR_COMPLETED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'MEMORY_CARD_REVIEWED' THEN ARRAY['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent']
    WHEN 'REVISION_CARD_REVIEWED' THEN ARRAY['memory_agent', 'atlas_agent', 'planner_agent']
    WHEN 'REVISION_COMPLETED' THEN ARRAY['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent']
    WHEN 'MEMORY_CARD_CREATE_REQUESTED' THEN ARRAY['memory_agent']
    WHEN 'ATLAS_MASTERY_UPDATED' THEN ARRAY['learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'ATLAS_MASTERY_UPDATE_REQUESTED' THEN ARRAY['atlas_agent']
    WHEN 'MEMORY_CARD_CREATED' THEN ARRAY['learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'CONCEPT_DISCOVERED' THEN ARRAY['concept_expansion_engine']
    WHEN 'INGESTION_DOCUMENT_PROCESSED' THEN ARRAY['learning_state_engine']
    WHEN 'MIND_MESSAGE_CREATED' THEN ARRAY['learning_state_engine']
    WHEN 'SESSION_CARD_COMPLETED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent']
    WHEN 'SESSION_RECOMMENDATION_REQUESTED' THEN ARRAY['planner_agent']
    WHEN 'SESSION_RECOMMENDATION_CREATED' THEN ARRAY['mind_agent']
    WHEN 'LEARNER_STATE_CHANGED' THEN ARRAY['planner_agent', 'mind_agent']
    WHEN 'PLANNER_REPLAN_REQUESTED' THEN ARRAY['planner_agent', 'command_agent']
    WHEN 'STUDENT_MODEL_SYNC_REQUESTED' THEN ARRAY['learning_state_engine']
    WHEN 'PRACTICE_ATTEMPT_RECORDED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'PRACTICE_ATTEMPT_SUBMITTED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'command_agent', 'planner_agent']
    WHEN 'ONBOARDING_QUIZ_COMPLETE' THEN ARRAY['learning_state_engine', 'planner_agent', 'command_agent']
    WHEN 'HERMES_MISTAKE_REVIEW_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_SOURCE_PROCESS_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_REVISION_QUALITY_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_TRACE_REQUESTED' THEN ARRAY['hermes_worker']
    WHEN 'HERMES_NEXT_ACTION_REQUESTED' THEN ARRAY['hermes_worker']
    ELSE ARRAY[]::text[]
  END;

  IF p_user_id IS NULL OR array_length(v_consumers, 1) IS NULL THEN
    RAISE EXCEPTION 'unsupported_event_type';
  END IF;

  WITH inserted AS (
    INSERT INTO public.event_queue (
      user_id, type, payload, idempotency_key, metadata, status, next_attempt_at
    ) VALUES (
      p_user_id,
      p_type,
      COALESCE(p_data, '{}'::jsonb),
      p_idempotency_key,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('source', COALESCE(p_source, 'system')),
      'PENDING',
      now()
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  )
  SELECT id INTO v_event_id FROM inserted;

  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id
    FROM public.event_queue
    WHERE idempotency_key = p_idempotency_key;
    RETURN v_event_id;
  END IF;

  INSERT INTO public.consumer_locks (
    event_id,
    consumer_name,
    status,
    next_retry_at,
    next_attempt_at
  )
  SELECT
    v_event_id,
    unnest(v_consumers),
    'PENDING',
    now(),
    now()
  ON CONFLICT (event_id, consumer_name) DO NOTHING;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb) TO service_role;
