import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeUsageLimit } from '@/lib/utils/billing';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('legacy billing compatibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses finite manual plan limits for pro users', async () => {
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { manual_plan: 'pro', subscription_status: 'free' }, error: null }),
    };
    const client = {
      from: vi.fn(() => profileChain),
      rpc: vi.fn().mockResolvedValue({ data: { allowed: true, used: 1, remaining: 79, limit: 80 }, error: null }),
    };
    (createAdminClient as any).mockReturnValue(client);

    const result = await consumeUsageLimit('user-1', 'chat_messages_daily');

    expect(result).toMatchObject({ allowed: true, limit: 80 });
    expect(client.rpc).toHaveBeenCalledWith('check_and_increment_usage_gate', expect.objectContaining({
      p_limit: 80,
    }));
  });
});
