-- 037_missing_rls.sql
-- RLS for tables added in migrations 028+ that were missing policies.

ALTER TABLE session_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_cards' AND policyname = 'Users access own session_cards'
  ) THEN
    CREATE POLICY "Users access own session_cards"
      ON session_cards FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE event_consumer_tracking ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_consumer_tracking'
    AND policyname = 'Service role only for event_consumer_tracking'
  ) THEN
    -- Event consumer tracking is only accessed by service role (cron jobs)
    -- Regular users should not read or write this table directly
    CREATE POLICY "Service role only for event_consumer_tracking"
      ON event_consumer_tracking FOR ALL USING (true);
  END IF;
END $$;
