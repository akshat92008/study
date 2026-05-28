CREATE TABLE IF NOT EXISTS event_consumer_tracking (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES student_events(id) ON DELETE CASCADE,
  consumer_name text NOT NULL,
  status        text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  retry_count   integer NOT NULL DEFAULT 0,
  last_error    text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(event_id, consumer_name)
);

CREATE INDEX IF NOT EXISTS idx_ect_event_id ON event_consumer_tracking(event_id);
CREATE INDEX IF NOT EXISTS idx_ect_status ON event_consumer_tracking(status);

CREATE TABLE IF NOT EXISTS dlq_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE,
  trace_id      uuid,
  version       text,
  type          text NOT NULL,
  data          jsonb,
  metadata      jsonb,
  error_message text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE event_consumer_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlq_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON event_consumer_tracking
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON dlq_events
  USING (auth.role() = 'service_role');
