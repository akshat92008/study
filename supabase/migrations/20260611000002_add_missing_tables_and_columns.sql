-- Comprehensive migration to add all missing tables and columns for MVP
-- This includes event queue tables, types, and functions required for the worker

DO $$
BEGIN
  -- Create ENUM types first
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status') THEN
    CREATE TYPE event_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consumer_lock_status') THEN
    CREATE TYPE consumer_lock_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY_SCHEDULED', 'DLQ');
  END IF;
  
  -- Create event_queue table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_queue') THEN
    CREATE TABLE public.event_queue (
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
  END IF;
  
  -- Create consumer_locks table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'consumer_locks') THEN
    CREATE TABLE public.consumer_locks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid REFERENCES event_queue(id) ON DELETE CASCADE,
      consumer_name text NOT NULL,
      status consumer_lock_status DEFAULT 'PENDING',
      worker_id text,
      lease_expires_at timestamptz,
      retry_count int DEFAULT 0,
      next_retry_at timestamptz DEFAULT now(),
      next_attempt_at timestamptz,
      last_error text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(event_id, consumer_name)
    );
    
    -- Add index for efficient leasing query
    CREATE INDEX IF NOT EXISTS idx_consumer_locks_leasing 
    ON consumer_locks(status, next_retry_at, lease_expires_at);
  ELSE
    -- Add any missing columns to consumer_locks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'consumer_locks' AND column_name = 'next_attempt_at') THEN
      ALTER TABLE public.consumer_locks ADD COLUMN next_attempt_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'consumer_locks' AND column_name = 'last_error') THEN
      ALTER TABLE public.consumer_locks ADD COLUMN last_error text;
    END IF;
  END IF;
  
  -- Create event_attempts table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_attempts') THEN
    CREATE TABLE public.event_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      consumer_lock_id uuid REFERENCES consumer_locks(id) ON DELETE CASCADE,
      event_id uuid,
      consumer_name text,
      worker_id text,
      error_message text,
      result_status text,
      result_reason text,
      started_at timestamptz DEFAULT now(),
      finished_at timestamptz
    );
  ELSE
    -- Add any missing columns to event_attempts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attempts' AND column_name = 'event_id') THEN
      ALTER TABLE public.event_attempts ADD COLUMN event_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attempts' AND column_name = 'consumer_name') THEN
      ALTER TABLE public.event_attempts ADD COLUMN consumer_name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attempts' AND column_name = 'result_status') THEN
      ALTER TABLE public.event_attempts ADD COLUMN result_status text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attempts' AND column_name = 'result_reason') THEN
      ALTER TABLE public.event_attempts ADD COLUMN result_reason text;
    END IF;
  END IF;
  
  -- Create event_dlq table with all columns the worker expects
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_dlq') THEN
    CREATE TABLE public.event_dlq (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid,
      user_id uuid,
      consumer_name text,
      event_type text,
      payload jsonb,
      event_metadata jsonb,
      attempts int,
      last_attempt_at timestamptz,
      last_error text,
      created_at timestamptz DEFAULT now(),
      resolved_at timestamptz,
      resolution_notes text
    );
  ELSE
    -- Add missing columns to existing event_dlq table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'user_id') THEN
      ALTER TABLE public.event_dlq ADD COLUMN user_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'event_type') THEN
      ALTER TABLE public.event_dlq ADD COLUMN event_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'event_metadata') THEN
      ALTER TABLE public.event_dlq ADD COLUMN event_metadata jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'attempts') THEN
      ALTER TABLE public.event_dlq ADD COLUMN attempts int;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'last_attempt_at') THEN
      ALTER TABLE public.event_dlq ADD COLUMN last_attempt_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'resolved_at') THEN
      ALTER TABLE public.event_dlq ADD COLUMN resolved_at timestamptz;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_dlq' AND column_name = 'resolution_notes') THEN
      ALTER TABLE public.event_dlq ADD COLUMN resolution_notes text;
    END IF;
  END IF;
END $$;

-- Postgres Function to atomically acquire leases
CREATE OR REPLACE FUNCTION public.acquire_event_leases(
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

-- Function to create event with consumers
CREATE OR REPLACE FUNCTION public.create_event_with_consumers(
    p_user_id uuid,
    p_type text,
    p_data jsonb,
    p_idempotency_key text,
    p_source text,
    p_metadata jsonb,
    p_consumers text[]
) RETURNS uuid 
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT v_event_id, unnest(p_consumers), 'PENDING';

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Create other missing tables
DO $$
BEGIN
  -- Create study_sessions table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'study_sessions') THEN
    CREATE TABLE public.study_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL,
      subject text,
      chapter text,
      concept_name text,
      concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'in_progress',
      duration_minutes integer NOT NULL DEFAULT 25,
      streak_days integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz
    );
  END IF;
  
  -- Create mastery_events table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mastery_events') THEN
    CREATE TABLE public.mastery_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL,
      evidence_type text NOT NULL,
      source text NOT NULL,
      source_id text,
      weight numeric NOT NULL DEFAULT 1.0,
      confidence numeric NOT NULL DEFAULT 1.0,
      evidence text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, concept_id, evidence_type, source, source_id)
    );
  END IF;
  
  -- Create chat_sessions table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    CREATE TABLE public.chat_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL,
      title text,
      summary text,
      message_count int DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
  
  -- Create hermes_learning_memories table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hermes_learning_memories') THEN
    CREATE TABLE public.hermes_learning_memories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL,
      concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL,
      pattern_type text NOT NULL,
      pattern text NOT NULL,
      severity text NOT NULL DEFAULT 'medium',
      action_type text,
      subject text,
      topic text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
  
  -- Create autopsy_jobs table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autopsy_jobs') THEN
    CREATE TABLE public.autopsy_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
  
  -- Add missing columns to revision_cards
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revision_cards') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'concept_id') THEN
      ALTER TABLE public.revision_cards ADD COLUMN concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'goal_id') THEN
      ALTER TABLE public.revision_cards ADD COLUMN goal_id uuid REFERENCES public.learning_goals(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'chat_session_id') THEN
      ALTER TABLE public.revision_cards ADD COLUMN chat_session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'source_type') THEN
      ALTER TABLE public.revision_cards ADD COLUMN source_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'source_id') THEN
      ALTER TABLE public.revision_cards ADD COLUMN source_id text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'metadata') THEN
      ALTER TABLE public.revision_cards ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'subject') THEN
      ALTER TABLE public.revision_cards ADD COLUMN subject text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'revision_cards' AND column_name = 'chapter') THEN
      ALTER TABLE public.revision_cards ADD COLUMN chapter text;
    END IF;
  END IF;
  
  -- Add missing columns to practice_attempts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'practice_attempts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'practice_attempts' AND column_name = 'idempotency_key') THEN
      ALTER TABLE public.practice_attempts ADD COLUMN idempotency_key text;
    END IF;
  END IF;
  
  -- Create practice tables if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'practice_sets') THEN
    CREATE TABLE public.practice_sets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      goal_id UUID NULL REFERENCES public.learning_goals(id) ON DELETE SET NULL,
      chat_session_id UUID NULL,
      message_id UUID NULL,
      topic TEXT NOT NULL,
      subject TEXT NULL,
      exam_type TEXT NULL,
      set_type TEXT NOT NULL CHECK (set_type IN ('mcq', 'flashcard')),
      source TEXT NOT NULL DEFAULT 'mind',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_practice_sets_message_id ON public.practice_sets (message_id);
    CREATE INDEX IF NOT EXISTS idx_practice_sets_user_id ON public.practice_sets (user_id);
    CREATE INDEX IF NOT EXISTS idx_practice_sets_goal_id ON public.practice_sets (goal_id);
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'practice_sets' AND column_name = 'goal_id') THEN
      ALTER TABLE public.practice_sets ADD COLUMN goal_id UUID NULL REFERENCES public.learning_goals(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'practice_sets' AND column_name = 'updated_at') THEN
      ALTER TABLE public.practice_sets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'practice_items') THEN
    CREATE TABLE public.practice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      practice_set_id UUID NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      concept_id UUID NULL,
      concept_name TEXT NULL,
      question TEXT NOT NULL,
      options JSONB NULL,
      correct_answer TEXT NULL,
      explanation TEXT NULL,
      difficulty TEXT NULL,
      position INT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_practice_items_set_id ON public.practice_items (practice_set_id);
    CREATE INDEX IF NOT EXISTS idx_practice_items_user_id ON public.practice_items (user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'practice_attempts') THEN
    CREATE TABLE public.practice_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      practice_set_id UUID NOT NULL REFERENCES public.practice_sets(id) ON DELETE CASCADE,
      practice_item_id UUID NOT NULL REFERENCES public.practice_items(id) ON DELETE CASCADE,
      answer TEXT NULL,
      is_correct BOOLEAN NULL,
      confidence TEXT NULL CHECK (confidence IN ('easy', 'medium', 'hard', 'forgot', 'knew')),
      time_taken_seconds INT NULL,
      idempotency_key TEXT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT practice_attempts_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_id ON public.practice_attempts (user_id);
    CREATE INDEX IF NOT EXISTS idx_practice_attempts_item_id ON public.practice_attempts (practice_item_id);
  END IF;
END $$;
