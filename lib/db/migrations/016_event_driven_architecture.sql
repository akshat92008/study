-- 016_event_driven_architecture.sql
-- Phase 9: Event-Driven Architecture (Idempotency, DLQ, Retries)

-- 1. Upgrade student_events table
ALTER TABLE student_events ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE student_events ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE student_events ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE student_events ADD COLUMN IF NOT EXISTS error_message text;

-- 2. Add idempotency constraint (allows NULLs to avoid breaking legacy rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_events_idempotency 
ON student_events (user_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. Create Dead Letter Queue (DLQ)
CREATE TABLE IF NOT EXISTS dlq_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  data jsonb NOT NULL,
  error_message text,
  failed_at timestamp WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Secure DLQ
ALTER TABLE dlq_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'dlq_events' AND policyname = 'Users can manage their own dlq events'
  ) THEN
    CREATE POLICY "Users can manage their own dlq events" ON dlq_events
    FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;

-- 5. Add index for faster orchestrator querying
CREATE INDEX IF NOT EXISTS idx_student_events_status ON student_events(status, created_at ASC);
