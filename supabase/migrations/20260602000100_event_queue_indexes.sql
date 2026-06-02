-- Migration to add observability indexes to the event queue
CREATE INDEX IF NOT EXISTS idx_event_queue_status_created ON public.event_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_event_queue_user_id ON public.event_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_type ON public.event_queue(type);

-- consumer_locks already has an index for leasing (status, next_retry_at, lease_expires_at)
-- but we also need one on event_id for joining
CREATE INDEX IF NOT EXISTS idx_consumer_locks_event_id ON public.consumer_locks(event_id);

-- Fix missing columns in event_dlq that worker.ts expects
ALTER TABLE public.event_dlq
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS event_type text,
ADD COLUMN IF NOT EXISTS event_metadata jsonb,
ADD COLUMN IF NOT EXISTS attempts int,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
