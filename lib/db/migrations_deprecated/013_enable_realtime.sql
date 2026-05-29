-- Enable Realtime for student_events
-- This allows the client to subscribe to changes on this table

BEGIN;

-- Check if publication exists, if not create it. Supabase usually creates supabase_realtime by default.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add the table to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE student_events;

COMMIT;
