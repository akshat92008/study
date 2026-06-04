import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeTextGeneration, routeStreamGeneration } from '@/lib/ai/router';
import { getLimit, consumeUsageLimit } from '@/lib/utils/billing';

// Mock billing dependencies
vi.mock('@/lib/utils/billing', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    consumeUsageLimit: vi.fn(),
  };
});

describe('AI Cost and Rate Limit Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Global AI Kill Switch', () => {
    it('routeTextGeneration returns graceful fallback when AI_DISABLED is true', async () => {
      process.env.AI_DISABLED = 'true';
      const result = await routeTextGeneration('chat', 'system', 'user', 0.7, 100);
      expect(result).toBe('AI features are temporarily paused for maintenance. Please check back shortly.');
    });

    it('routeStreamGeneration yields graceful fallback when AI_DISABLED is true', async () => {
      process.env.AI_DISABLED = 'true';
      const generator = routeStreamGeneration('system', 'user');
      const { value, done } = await generator.next();
      expect(value).toBe('AI features are temporarily paused for maintenance. Please check back shortly.');
      const next = await generator.next();
      expect(next.done).toBe(true);
    });
  });

  describe('Billing Limits (billing.ts)', () => {
    it('returns the correct default hourly chat limit', () => {
      expect(getLimit('chat_messages_hourly')).toBe(10);
    });

    it('returns the correct default daily expensive operations limit', () => {
      expect(getLimit('expensive_operations_daily')).toBe(10);
    });

    it('allows overriding limits via environment variables', () => {
      process.env.FREE_HOURLY_CHAT_LIMIT = '5';
      process.env.FREE_DAILY_EXPENSIVE_LIMIT = '2';
      expect(getLimit('chat_messages_hourly')).toBe(5);
      expect(getLimit('expensive_operations_daily')).toBe(2);
    });
  });
});
