CREATE OR REPLACE FUNCTION public.create_event_with_consumers(
    p_user_id uuid,
    p_type text,
    p_data jsonb,
    p_idempotency_key text,
    p_source text,
    p_metadata jsonb,
    p_consumers text[] DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_event_id uuid;
    v_consumers text[];
BEGIN
    -- Use the passed consumers array if provided, otherwise fallback to the hardcoded list
    IF p_consumers IS NOT NULL AND array_length(p_consumers, 1) > 0 THEN
        v_consumers := p_consumers;
    ELSE
        v_consumers := CASE p_type
            WHEN 'CHAT_MESSAGE_PROCESSED' THEN ARRAY['chat_side_effect_engine', 'mind_agent']
            WHEN 'CHAT_MESSAGE_CREATED' THEN ARRAY['chat_side_effect_engine', 'mind_agent']
            WHEN 'CHAT_LEARNING_SIGNAL' THEN ARRAY['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent']
            WHEN 'CHAT_SESSION_SUMMARIZE' THEN ARRAY['chat_side_effect_engine']
            WHEN 'MATERIAL_UPLOADED' THEN ARRAY['rag_agent']
            WHEN 'MATERIAL_INGESTION_REQUESTED' THEN ARRAY['rag_agent']
            WHEN 'MATERIAL_INGESTED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent']
            WHEN 'RAG_QUERY_USED' THEN ARRAY['mind_agent']
            WHEN 'RAG_CARD_CANDIDATE_CREATED' THEN ARRAY['memory_agent']
            WHEN 'MIND_ACTION_REQUESTED' THEN ARRAY['mind_agent']
            WHEN 'MIND_CONTEXT_REFRESHED' THEN ARRAY['mind_agent']
            WHEN 'AUTOPSY_UPLOAD_RECEIVED' THEN ARRAY['autopsy_engine']
            WHEN 'MOCK_TEST_UPLOADED' THEN ARRAY['autopsy_engine']
            WHEN 'AUTOPSY_PROCESSING_COMPLETED' THEN ARRAY['autopsy_agent', 'planner_agent']
            WHEN 'TEST_ANALYSIS_COMPLETED' THEN ARRAY['autopsy_agent', 'planner_agent']
            WHEN 'AUTOPSY_MISTAKE_EXTRACTED' THEN ARRAY['autopsy_agent']
            WHEN 'AUTOPSY_MISTAKE_APPROVED' THEN ARRAY['atlas_agent', 'memory_agent', 'planner_agent']
            WHEN 'AUTOPSY_MISTAKE_REJECTED' THEN ARRAY['autopsy_agent']
            WHEN 'AUTOPSY_MOCK_PROCESSED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'planner_agent']
            WHEN 'MOCK_TEST_ANALYZED' THEN ARRAY['atlas_engine', 'memory_engine', 'learning_state_engine', 'planner_agent']
            WHEN 'AUTOPSY_V3_ASSESSMENT_CREATED' THEN ARRAY['autopsy_agent']
            ELSE ARRAY[]::text[]
        END;
    END IF;

    -- Insert into event_queue. If idempotency_key exists, DO NOTHING to prevent duplicate.
    WITH inserted AS (
        INSERT INTO event_queue (
            user_id, type, payload, idempotency_key, metadata, status
        ) VALUES (
            p_user_id,
            p_type,
            p_data,
            p_idempotency_key,
            COALESCE(p_metadata, '{}'::jsonb),
            'PENDING'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
    )
    SELECT id INTO v_event_id FROM inserted;

    -- If no event was inserted, it means it's a duplicate. We fetch the existing ID.
    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM event_queue WHERE idempotency_key = p_idempotency_key LIMIT 1;
    END IF;

    IF v_event_id IS NOT NULL AND v_consumers IS NOT NULL THEN
        INSERT INTO consumer_locks (event_id, consumer_name, status)
        SELECT v_event_id, unnest(v_consumers), 'PENDING'
        ON CONFLICT (event_id, consumer_name) DO NOTHING;
    END IF;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

revoke execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb, text[]) from public, authenticated;
grant execute on function public.create_event_with_consumers(uuid, text, jsonb, text, text, jsonb, text[]) to service_role;
