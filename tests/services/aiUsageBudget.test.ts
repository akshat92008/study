import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: vi.fn(),
  }),
}));

describe('AI usage budget enforcement', () => {
  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    process.env.AI_DAILY_USER_BUDGET_USD = '0.01';
    delete process.env.BYPASS_ALL_LIMITS;
  });

  it('allows requests within the configured daily budget', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { estimated_cost: 0.005 }, error: null });
    const { assertDailyAIUsageBudget } = await import('@/lib/services/ai-usage.service');

    await expect(assertDailyAIUsageBudget({
      userId: 'user-1',
      kind: 'chat',
      estimatedCost: 0.002,
    })).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('ai_usage_daily');
  });

  it('rejects requests that would exceed the configured daily budget', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { estimated_cost: 0.015 }, error: null });
    const { assertDailyAIUsageBudget, AIUsageBudgetExceededError } = await import('@/lib/services/ai-usage.service');

    await expect(assertDailyAIUsageBudget({
      userId: 'user-1',
      kind: 'autopsy',
      estimatedCost: 0.002,
    })).rejects.toBeInstanceOf(AIUsageBudgetExceededError);
  });
});
