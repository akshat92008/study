import { describe, expect, it, vi } from 'vitest';
import { budgetLLMMessages } from '@/lib/ai/token-budget';
import { logger } from '@/lib/utils/logger';

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('LLM token budgeting', () => {
  it('trims old history while preserving the current user message', () => {
    const current = 'Please explain Hess Law from first principles.';
    const result = budgetLLMMessages({
      route: 'test',
      maxPromptChars: 180,
      messages: [
        { role: 'system', content: 'system '.repeat(30) },
        { role: 'user', content: 'old user '.repeat(30) },
        { role: 'assistant', content: 'old answer '.repeat(30) },
        { role: 'user', content: current },
      ],
    });

    expect(result.trimmed).toBe(true);
    expect(result.messages.at(-1)?.content).toBe(current);
    expect(result.finalTokens).toBeLessThan(result.originalTokens);
    expect(logger.warn).toHaveBeenCalledWith(
      '[TokenBudget] Trimmed LLM input before provider call',
      expect.objectContaining({
        route: 'test',
        fieldsTrimmed: expect.any(Array),
      })
    );
  });
});
