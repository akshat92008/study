import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BudgetAgent,
  agentBackgroundModel,
  agentLlmCallsEnabled,
  getAgentBudgetLimits,
} from '@/lib/amaura/agents/budget';

describe('Amaura BudgetAgent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults background AI calls to disabled and gemini-flash', async () => {
    expect(agentLlmCallsEnabled()).toBe(false);
    expect(agentBackgroundModel()).toBe('gemini-flash');

    const budget = new BudgetAgent({
      userId: 'user-1',
      agentName: 'PracticePatternAgent',
      policy: { maxAiCalls: 1, model: 'gemini-flash', requireBudget: true },
    });

    await expect(budget.canUseAi()).resolves.toBe(false);
  });

  it('fails closed when model or caps do not match the Hobby-safe policy', async () => {
    vi.stubEnv('ENABLE_AGENT_LLM_CALLS', 'true');
    vi.stubEnv('AGENT_BACKGROUND_MODEL', 'gpt-5');
    vi.stubEnv('MAX_AGENT_AI_CALLS_PER_USER_PER_DAY', '0');

    expect(agentLlmCallsEnabled()).toBe(true);
    expect(agentBackgroundModel()).toBe('gpt-5');
    expect(getAgentBudgetLimits().perUserDaily).toBe(0);

    const budget = new BudgetAgent({
      userId: 'user-1',
      agentName: 'AutopsyCascadeAgent',
      policy: { maxAiCalls: 1, model: 'gemini-flash', requireBudget: true },
    });

    await expect(budget.canUseAi()).resolves.toBe(false);
  });
});
