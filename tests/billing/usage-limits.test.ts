import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkUsageLimit, getLimit } from '../../lib/utils/billing';
import { createAdminClient } from '../../lib/supabase/admin';

vi.mock('../../lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Usage Limits', () => {
  beforeEach(() => {
    delete process.env.BYPASS_ALL_LIMITS;
  });

  it('handles missing usage row safely', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (createAdminClient as any).mockReturnValue(mockSupabase);

    const result = await checkUsageLimit('test-user-id', 'chat_messages_daily');
    expect(result.allowed).toBe(true);
  });

  it('correctly maps fields for hourly and expensive operations', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          chat_messages: 5,
          chat_messages_hourly: 15,
          expensive_operations: 1,
        },
        error: null,
      }),
    };
    (createAdminClient as any).mockReturnValue(mockSupabase);

    const hourlyResult = await checkUsageLimit('test-user-id', 'chat_messages_hourly');
    // Assuming limit is > 15
    expect(hourlyResult.allowed).toBe(15 < getLimit('chat_messages_hourly'));

    const expensiveResult = await checkUsageLimit('test-user-id', 'expensive_operations_daily');
    // Assuming limit is > 1
    expect(expensiveResult.allowed).toBe(1 < getLimit('expensive_operations_daily'));
  });
});
