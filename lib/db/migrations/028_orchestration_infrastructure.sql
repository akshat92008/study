-- Migration 028: Orchestration Infrastructure & Distributed Event Bus

-- 1. Upgrade the student_events table to support tracing and versioning
ALTER TABLE public.student_events
ADD COLUMN version TEXT DEFAULT 'v1' NOT NULL,
ADD COLUMN trace_id UUID DEFAULT gen_random_uuid() NOT NULL,
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
ADD COLUMN last_error TEXT;

-- 2. Create the DLQ (Dead Letter Queue) table for fatal events
CREATE TABLE IF NOT EXISTS public.dlq_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL, -- The original event ID
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trace_id UUID NOT NULL,
  version TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  metadata JSONB NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

-- Index for querying DLQ by user or unresolved
CREATE INDEX IF NOT EXISTS idx_dlq_events_unresolved ON public.dlq_events(created_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dlq_events_user ON public.dlq_events(user_id);

-- 3. Consumer Isolation Tracking
-- To guarantee at-least-once delivery per consumer, we track which consumer processed which event.
CREATE TABLE IF NOT EXISTS public.event_consumer_tracking (
  event_id UUID REFERENCES public.student_events(id) ON DELETE CASCADE,
  consumer_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing' NOT NULL,
  retry_count INT DEFAULT 0 NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (event_id, consumer_name)
);

CREATE INDEX IF NOT EXISTS idx_consumer_tracking_status ON public.event_consumer_tracking(consumer_name, status);

-- Trigger to update updated_at on event_consumer_tracking
CREATE TRIGGER set_consumer_tracking_updated_at
BEFORE UPDATE ON public.event_consumer_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.dlq_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_consumer_tracking ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access dlq" ON public.dlq_events
  FOR ALL USING (true);
CREATE POLICY "Service role full access consumers" ON public.event_consumer_tracking
  FOR ALL USING (true);
