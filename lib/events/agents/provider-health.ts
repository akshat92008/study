// lib/events/agents/provider-health.ts

/**
 * Simple provider health tracking.
 * Stores health status in Supabase table `provider_health` with columns:
 *   - provider (text, primary key)
 *   - status   (text, "healthy" | "unhealthy")
 *   - last_checked (timestamp)
 *   - failure_reason (text, nullable)
 *
 * The table should be created in the database migrations.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export const recordProviderHealth = async (
  provider: string,
  healthy: boolean,
  reason?: string
): Promise<void> => {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('provider_health')
    .upsert({
      provider,
      status: healthy ? 'healthy' : 'unhealthy',
      last_checked: new Date().toISOString(),
      failure_reason: reason ?? null,
    }, { onConflict: 'provider' });
  if (error) {
    console.error('Failed to upsert provider health', { provider, error });
  }
};

export const isProviderHealthy = async (provider: string): Promise<boolean> => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('provider_health')
    .select('status')
    .eq('provider', provider)
    .maybeSingle();
  if (error) {
    console.error('Error fetching provider health', { provider, error });
    return false;
  }
  return data?.status === 'healthy';
};

/**
 * Wrap a provider call with health checking.
 * Usage:
 *   const result = await withProviderHealth('openai', async () => {
 *     return await openai.chat(...);
 *   });
 */
export const withProviderHealth = async <T>(
  provider: string,
  fn: () => Promise<T>
): Promise<T> => {
  try {
    const res = await fn();
    await recordProviderHealth(provider, true);
    return res;
  } catch (err: any) {
    await recordProviderHealth(provider, false, err.message);
    throw err;
  }
};
