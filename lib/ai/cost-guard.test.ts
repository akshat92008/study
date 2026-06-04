import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBudgetExceeded, isBudgetUnavailable, AIBudgetExceededError, BudgetSystemUnavailableError } from './cost-guard';

describe('cost-guard errors', () => {
  it('should identify AIBudgetExceededError', () => {
    const error = new AIBudgetExceededError(0.25, 0.01);
    expect(isBudgetExceeded(error)).toBe(true);
    expect(isBudgetUnavailable(error)).toBe(false);
  });

  it('should identify BudgetSystemUnavailableError', () => {
    const error = new BudgetSystemUnavailableError();
    expect(isBudgetUnavailable(error)).toBe(true);
    expect(isBudgetExceeded(error)).toBe(false);
  });

  it('should return false for other errors', () => {
    const error = new Error('Random error');
    expect(isBudgetExceeded(error)).toBe(false);
    expect(isBudgetUnavailable(error)).toBe(false);
  });
});
