-- Migration: 20260529000008_event_queue_tables.sql

CREATE TYPE event_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE consumer_lock_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY_SCHEDULED', 'DLQ');

CREATE TABLE IF NOT EXISTS event_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    idempotency_key text UNIQUE,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    status event_status DEFAULT 'PENDING',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumer_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES event_queue(id) ON DELETE CASCADE,
    consumer_name text NOT NULL,
    status consumer_lock_status DEFAULT 'PENDING',
    worker_id text,
    lease_expires_at timestamptz,
    retry_count int DEFAULT 0,
    next_retry_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(event_id, consumer_name)
);

-- Index for efficient leasing query
CREATE INDEX idx_consumer_locks_leasing 
ON consumer_locks(status, next_retry_at, lease_expires_at);

CREATE TABLE IF NOT EXISTS event_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_lock_id uuid REFERENCES consumer_locks(id) ON DELETE CASCADE,
    worker_id text,
    error_message text,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS event_dlq (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid,
    consumer_name text,
    payload jsonb,
    last_error text,
    created_at timestamptz DEFAULT now()
);

-- Postgres Function to atomically acquire leases
CREATE OR REPLACE FUNCTION acquire_event_leases(
    p_worker_id text,
    p_limit int,
    p_lease_timeout interval
) RETURNS TABLE (
    lock_id uuid,
    event_id uuid,
    consumer_name text,
    event_type text,
    event_payload jsonb,
    event_metadata jsonb,
    user_id uuid,
    retry_count int
) AS $$
BEGIN
    RETURN QUERY
    WITH available_locks AS (
        SELECT cl.id
        FROM consumer_locks cl
        WHERE cl.status IN ('PENDING', 'RETRY_SCHEDULED')
          AND cl.next_retry_at <= now()
          AND (cl.lease_expires_at IS NULL OR cl.lease_expires_at < now())
        ORDER BY cl.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    ),
    updated_locks AS (
        UPDATE consumer_locks cl
        SET status = 'PROCESSING',
            worker_id = p_worker_id,
            lease_expires_at = now() + p_lease_timeout,
            updated_at = now()
        FROM available_locks al
        WHERE cl.id = al.id
        RETURNING cl.id, cl.event_id, cl.consumer_name, cl.retry_count
    )
    SELECT 
        ul.id, 
        ul.event_id, 
        ul.consumer_name, 
        eq.type, 
        eq.payload, 
        eq.metadata, 
        eq.user_id, 
        ul.retry_count
    FROM updated_locks ul
    JOIN event_queue eq ON eq.id = ul.event_id;
END;
$$ LANGUAGE plpgsql;

-- Replace existing create_event_with_consumers to use new tables seamlessly
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

    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM event_queue WHERE idempotency_key = p_idempotency_key;
        RETURN v_event_id; -- Already exists, idempotency guarantees no double execution
    END IF;

    -- Insert locks for consumers
    INSERT INTO consumer_locks (event_id, consumer_name, status)
    SELECT v_event_id, unnest(ARRAY['learning_state_engine','atlas_engine','memory_engine','command_engine','concept_expansion_engine']::text[]), 'PENDING';

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE;
