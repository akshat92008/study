-- ==========================================
-- COGNITION OS: RATE LIMITING MIGRATION
-- ==========================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  ip TEXT PRIMARY KEY,
  request_count INT DEFAULT 1,
  last_reset TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION check_rate_limit(p_ip TEXT, p_limit INT, p_window_seconds INT)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO api_rate_limits (ip, request_count, last_reset)
  VALUES (p_ip, 1, now())
  ON CONFLICT (ip) DO UPDATE
  SET 
    request_count = CASE 
      WHEN api_rate_limits.last_reset < now() - (p_window_seconds * interval '1 second') THEN 1 
      ELSE api_rate_limits.request_count + 1 
    END,
    last_reset = CASE 
      WHEN api_rate_limits.last_reset < now() - (p_window_seconds * interval '1 second') THEN now() 
      ELSE api_rate_limits.last_reset 
    END
  RETURNING request_count INTO v_count;
  
  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
