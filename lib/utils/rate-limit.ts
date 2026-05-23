import { createClient } from '@/lib/supabase/server';

/**
 * Supabase-backed rate limiter. Works across all serverless instances.
 * Falls open (returns true) if DB is unavailable — never blocks legit traffic.
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    const { count, error } = await supabase
      .from('rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart);

    if (error) return true; // fail open

    if ((count ?? 0) >= maxRequests) return false;

    await supabase
      .from('rate_limit_log')
      .insert({ key, created_at: new Date().toISOString() });

    return true;
  } catch {
    return true; // fail open — never break the product over rate limit check
  }
}
