-- Migration: 20260530000013_expire_stale_ai_reservations.sql
-- Purpose: Expire stale AI budget reservations to free up budget.

CREATE OR REPLACE FUNCTION public.expire_stale_ai_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN 
    SELECT id, user_id, usage_date, estimated_cost, estimated_tokens 
    FROM public.ai_budget_reservations 
    WHERE status = 'reserved' AND created_at < NOW() - INTERVAL '5 minutes'
  LOOP
    UPDATE public.ai_budget_reservations
    SET status = 'released', updated_at = NOW()
    WHERE id = v_rec.id;

    UPDATE public.ai_usage_daily
    SET reserved_cost = GREATEST(0, COALESCE(reserved_cost, 0) - COALESCE(v_rec.estimated_cost, 0)),
        reserved_tokens = GREATEST(0, COALESCE(reserved_tokens, 0) - COALESCE(v_rec.estimated_tokens, 0)),
        updated_at = NOW()
    WHERE user_id = v_rec.user_id AND usage_date = v_rec.usage_date;
  END LOOP;
END;
$$;
-- Revoke and grant as needed
REVOKE EXECUTE ON FUNCTION public.expire_stale_ai_reservations() FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_ai_reservations() TO service_role;
