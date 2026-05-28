-- Migration: create_event_with_consumers.sql
-- This function creates an event row and associated consumer tracking rows atomically.

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
BEGIN
    INSERT INTO student_events (
        user_id, type, data, status, retry_count, idempotency_key, trace_id, version, metadata, source
    ) VALUES (
        p_user_id,
        p_type,
        p_data,
        'pending',
        0,
        p_idempotency_key,
        gen_random_uuid(),
        'v2',
        COALESCE(p_metadata, '{}'::jsonb),
        p_source
    )
    RETURNING id INTO v_event_id;

    INSERT INTO event_consumer_tracking (event_id, consumer_name, status)
    SELECT v_event_id, unnest(ARRAY['learning_state_engine','atlas_engine','memory_engine','command_engine','concept_expansion_engine']::text[]), 'pending';

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE;
