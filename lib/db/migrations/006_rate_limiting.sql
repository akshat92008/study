-- Create table to store rate limit counters
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hits INT DEFAULT 1,
  last_reset TIMESTAMPTZ DEFAULT NOW()
);

-- RPC function to atomically check and update the limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_ip TEXT, p_limit INT, p_window_seconds INT)
RETURNS BOOLEAN AS $$
DECLARE
  current_hits INT;
  last_reset_time TIMESTAMPTZ;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT hits, last_reset INTO current_hits, last_reset_time
  FROM rate_limits WHERE key = p_ip FOR UPDATE;

  -- First time seeing this key
  IF NOT FOUND THEN
    INSERT INTO rate_limits (key, hits, last_reset) VALUES (p_ip, 1, NOW());
    RETURN TRUE;
  END IF;

  -- Window expired, reset counter
  IF NOW() > last_reset_time + (p_window_seconds || ' seconds')::interval THEN
    UPDATE rate_limits SET hits = 1, last_reset = NOW() WHERE key = p_ip;
    RETURN TRUE;
  END IF;

  -- Limit reached
  IF current_hits >= p_limit THEN
    RETURN FALSE;
  END IF;

  -- Increment counter
  UPDATE rate_limits SET hits = hits + 1 WHERE key = p_ip;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
