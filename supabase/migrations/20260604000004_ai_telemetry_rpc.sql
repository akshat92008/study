-- Phase 11: Admin Telemetry
-- We need to define get_ai_usage_summary_v2 since it is called in app/api/admin/ai-telemetry/route.ts
-- Currently returning a dummy structure or querying actual ai_usage_daily if available

CREATE OR REPLACE FUNCTION public.get_ai_usage_summary_v2()
RETURNS TABLE (
  total_requests bigint,
  total_tokens bigint,
  cost_estimate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(request_count), 0)::bigint as total_requests,
    COALESCE(SUM(total_tokens_used), 0)::bigint as total_tokens,
    0::numeric as cost_estimate
  FROM ai_usage_daily;
END;
$$;
