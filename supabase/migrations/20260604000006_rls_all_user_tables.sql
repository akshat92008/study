-- Phase 3: Database Hardening
-- Ensure ALL user-owned tables have RLS and user_id owner checks.
-- We explicitly set the policy for tables that might have been missed in earlier canonicalization.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'study_materials',
      'study_material_chunks',
      'rag_ingestion_jobs',
      'message_citations',
      'mastery_evidence_ledger',
      'agent_runs',
      'agent_actions',
      'agent_action_approvals',
      'agent_state_snapshots',
      'daily_plans',
      'daily_microtasks',
      'study_tasks',
      'practice_sets',
      'practice_items',
      'practice_attempts'
    ])
  LOOP
    IF EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      
      -- Drop old policy if it exists to replace it with the canonical one
      EXECUTE format('DROP POLICY IF EXISTS "users_all_own_%s" ON public.%I', t, t);
      
      -- Create the canonical owner policy
      EXECUTE format(
        'CREATE POLICY "users_all_own_%s" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t, t
      );
      
      -- Create the service_role bypass policy
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%s" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "service_role_all_%s" ON public.%I FOR ALL USING (current_setting(''request.jwt.claim.role'', true) = ''service_role'') WITH CHECK (current_setting(''request.jwt.claim.role'', true) = ''service_role'')',
        t, t
      );
    END IF;
  END LOOP;
END
$$;
