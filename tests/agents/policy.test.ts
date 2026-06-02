import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyAgentAction, shouldSkipAgentMutation } from '@/lib/agents/policy';

describe('cheap agent policy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('allows only beta-approved actions to auto-apply', () => {
    expect(classifyAgentAction('create_revision_card_from_verified_mistake')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('update_mastery_from_evidence')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('invalidate_session_card')).toEqual({ riskLevel: 'safe', autoApply: true });
  });

  it('auto-applies low-risk evidence actions and stores risky actions as proposals', () => {
    expect(classifyAgentAction('record_learning_evidence')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('tag_weak_topic')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('replace_daily_plan')).toEqual({ riskLevel: 'medium', autoApply: false });
  });

  it('enables mutating agent actions by default but honors the kill switch', () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', '');
    expect(shouldSkipAgentMutation()).toBe(false);

    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'false');
    expect(shouldSkipAgentMutation()).toBe(true);
  });
});
