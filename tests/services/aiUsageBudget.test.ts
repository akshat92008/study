import { describe, expect, it, vi, beforeEach } from 'vitest';

const { maybeSingle } = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle,
          }),
        }),
      }),
    }),
  }),
}));

describe('AI usage budget enforcement', () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    process.env.AI_DAILY_USER_BUDGET_USD = '0.01';
  });

  it('allows requests within the configured daily budget', async () => {
    maybeSingle.mockResolvedValue({ data: { estimated_cost: 0.001 }, error: null });
    const { assertDailyAIUsageBudget } = await import('@/lib/services/ai-usage.service');

    await expect(assertDailyAIUsageBudget({
      userId: 'user-1',
      kind: 'chat',
      estimatedCost: 0.002,
    })).resolves.toBeUndefined();
  });

  it('rejects requests that would exceed the configured daily budget', async () => {
    maybeSingle.mockResolvedValue({ data: { estimated_cost: 0.0095 }, error: null });
    const { assertDailyAIUsageBudget, AIUsageBudgetExceededError } = await import('@/lib/services/ai-usage.service');

    await expect(assertDailyAIUsageBudget({
      userId: 'user-1',
      kind: 'autopsy',
      estimatedCost: 0.002,
    })).rejects.toBeInstanceOf(AIUsageBudgetExceededError);
  });
});
