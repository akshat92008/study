-- ============================================================
-- MIGRATION 026: RLS ENFORCEMENT VERIFICATION + FORCE ENABLE
-- Run this in Supabase SQL Editor to confirm RLS is active.
-- ============================================================

-- 0. Ensure concepts table has importance column.
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'core';

-- 1. FORCE enable RLS on every user-data table.
-- These are idempotent — safe to run even if already enabled.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopsy_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_session_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_events ENABLE ROW LEVEL SECURITY;

-- 2. VERIFY: This query must return zero rows after running.
-- Any row here means a table has RLS disabled — immediate risk.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','concepts','revision_cards','study_tasks',
    'mock_autopsies','mistakes','materials','chat_memories',
    'performance_snapshots','pulse_signals'
  )
  AND rowsecurity = false;

-- 3. Ensure service_role bypass exists for cron jobs
-- (cron/daily-synthesis runs as service_role, must bypass RLS)
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- 4. Create missing policies if they don't exist
-- (Only creates, doesn't replace — safe to run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_memories' AND policyname = 'users_own_memories'
  ) THEN
    CREATE POLICY users_own_memories ON chat_memories
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tutor_session_states' AND policyname = 'users_own_tutor_states'
  ) THEN
    CREATE POLICY users_own_tutor_states ON tutor_session_states
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
