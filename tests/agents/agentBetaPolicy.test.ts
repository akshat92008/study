import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertBetaAgentActionAllowed } from '@/lib/agents/beta-policy';

describe('agent beta policy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('allows safe actions when the beta kill switch is unset', () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', '');
    expect(assertBetaAgentActionAllowed('create_revision_card_from_verified_mistake')).toEqual({ allowed: true });
  });

  it('skips actions when the beta kill switch is explicitly disabled', () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'false');
    expect(assertBetaAgentActionAllowed('create_revision_card_from_verified_mistake')).toEqual({
      allowed: false,
      reason: 'Agent actions are disabled for beta stability.',
    });
  });

  it('skips unknown actions even when agent actions are enabled', () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'true');
    expect(assertBetaAgentActionAllowed('replace_daily_plan')).toEqual({
      allowed: false,
      reason: 'Agent action replace_daily_plan is not allowed in beta.',
    });
  });

  it('allows explicit beta actions only when enabled', () => {
    vi.stubEnv('ENABLE_AGENT_ACTIONS', 'true');
    expect(assertBetaAgentActionAllowed('update_mastery_from_evidence')).toEqual({ allowed: true });
  });
});
