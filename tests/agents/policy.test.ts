import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyAgentAction, shouldSkipAgentMutation } from '@/lib/agents/policy';

describe('cheap agent policy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('allows only beta-approved actions to auto-apply', () => {
    expect(classifyAgentAction('create_revision_card_from_verified_mistake')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('update_mastery_from_evidence')).toEqual({ riskLevel: 'safe', autoApply: true });
    expect(classifyAgentAction('invalidate_session_card')).toEqual({ riskLevel: 'safe', autoApply: true });
  });

  it('stores non-allowlisted evidence actions and risky actions as proposals', () => {
    expect(classifyAgentAction('record_learning_evidence')).toEqual({ riskLevel: 'medium', autoApply: false });
    expect(classifyAgentAction('tag_weak_topic')).toEqual({ riskLevel: 'medium', autoApply: false });
    expect(classifyAgentAction('replace_daily_plan')).toEqual({ riskLevel: 'medium', autoApply: false });
  });

  it('disables mutating agent actions by default and honors explicit enablement', () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', '');
    expect(shouldSkipAgentMutation()).toBe(true);

    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'true');
    expect(shouldSkipAgentMutation()).toBe(false);
  });
});
