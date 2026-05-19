import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function rateLimit(ip: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const supabase = await createClient();
    const windowSeconds = Math.floor(windowMs / 1000);
    
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip: ip,
      p_limit: limit,
      p_window_seconds: windowSeconds
    });

    if (error) throw error;
    return data as boolean;
  } catch (err) {
    logger.error('Rate limiter fallback triggered', err);
    return true; // Fail open to not block users if DB lags
  }
}
