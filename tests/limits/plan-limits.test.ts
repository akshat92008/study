import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, getFeatureLimit, getPlanLimits } from '@/lib/billing/plan-limits';

describe('manual beta plan limits', () => {
  it('keeps every plan finite', () => {
    for (const limits of Object.values(PLAN_LIMITS)) {
      for (const value of Object.values(limits)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeLessThan(Number.MAX_SAFE_INTEGER);
      }
    }
  });

  it('uses the requested beta plan caps', () => {
    expect(getPlanLimits('free').dailyChatMessages).toBe(100);
    expect(getPlanLimits('founding').dailyAutopsyReports).toBe(20);
    expect(getPlanLimits('pro').monthlyAiBudgetUsd).toBe(30);
    expect(getPlanLimits('admin').dailyAiCalls).toBe(150);
  });

  it('maps feature names to finite limits', () => {
    expect(getFeatureLimit('founding', 'chat_message')).toBe(400);
    expect(getFeatureLimit('founding', 'material_upload')).toBe(100);
    expect(getFeatureLimit('pro', 'worker_ai_call')).toBe(500);
    expect(getFeatureLimit('admin', 'assessment_create')).toBe(500);
  });
});
