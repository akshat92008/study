-- event_consumer_tracking: remove the overly broad policy
-- Real access is via service_role only (EventDispatcher uses admin client)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_consumer_tracking'
    AND policyname = 'Service role full access consumers'
  ) THEN
    DROP POLICY "Service role full access consumers" ON public.event_consumer_tracking;
  END IF;
END $$;

-- authenticated users have no legitimate reason to query event_consumer_tracking directly
-- The select policy added in rls_policies migration via the loop is also wrong here
-- Drop it if it was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_consumer_tracking'
    AND policyname = 'event_consumer_tracking_select_own'
  ) THEN
    DROP POLICY "event_consumer_tracking_select_own" ON public.event_consumer_tracking;
  END IF;
END $$;

-- dlq_events: same fix
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dlq_events'
    AND policyname = 'Service role full access dlq'
  ) THEN
    DROP POLICY "Service role full access dlq" ON public.dlq_events;
  END IF;
END $$;

-- No authenticated policies on either table.
-- service_role bypasses RLS entirely — EventDispatcher admin client is unaffected.
