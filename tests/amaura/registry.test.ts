import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AMAURA_CONSUMERS,
  getAmauraAgentForConsumer,
  getAmauraRuntimeMap,
  getEnabledAmauraAgents,
  isAmauraConsumer,
} from '@/lib/amaura/agents/registry';
import { hasAmauraStateVisibleOutcome } from '@/lib/amaura/agents/types';

describe('Amaura native agent registry', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps each queue consumer to a native Amaura agent', () => {
    expect(AMAURA_CONSUMERS).toEqual([
      'amaura_practice_agent',
      'amaura_session_agent',
      'amaura_autopsy_cascade',
      'amaura_forgetting_agent',
      'amaura_stagnation_agent',
      'amaura_pattern_memory',
    ]);

    expect(getAmauraAgentForConsumer('amaura_practice_agent')?.name).toBe('PracticePatternAgent');
    expect(getAmauraAgentForConsumer('amaura_session_agent')?.name).toBe('SessionCloseAgent');
    expect(getAmauraAgentForConsumer('amaura_autopsy_cascade')?.name).toBe('AutopsyCascadeAgent');
    expect(getAmauraAgentForConsumer('amaura_forgetting_agent')?.name).toBe('ForgettingAgent');
    expect(getAmauraAgentForConsumer('amaura_stagnation_agent')?.name).toBe('StagnationAgent');
    expect(getAmauraAgentForConsumer('amaura_pattern_memory')?.name).toBe('PatternMemoryAgent');
    expect(getAmauraAgentForConsumer('hermes_worker')).toBeNull();
    expect(isAmauraConsumer('amaura_practice_agent')).toBe(true);
    expect(isAmauraConsumer('hermes_worker')).toBe(false);
  });

  it('exposes the full native runtime map while honoring the runtime kill switch', () => {
    expect(Object.keys(getAmauraRuntimeMap()).sort()).toEqual([
      'AutopsyCascadeAgent',
      'BudgetAgent',
      'ForgettingAgent',
      'PatternMemoryAgent',
      'PracticePatternAgent',
      'SessionCloseAgent',
      'StagnationAgent',
    ].sort());

    expect(getEnabledAmauraAgents().map((agent) => agent.name)).toContain('PracticePatternAgent');
    vi.stubEnv('ENABLE_AGENT_RUNTIME', 'false');
    expect(getEnabledAmauraAgents()).toEqual([]);
  });

  it('does not register noop placeholder agents as active Amaura agents', () => {
    const agents = getEnabledAmauraAgents();

    expect(agents.map((agent) => agent.name).sort()).toEqual([
      'AutopsyCascadeAgent',
      'ForgettingAgent',
      'PatternMemoryAgent',
      'PracticePatternAgent',
      'SessionCloseAgent',
      'StagnationAgent',
    ].sort());

    for (const agent of agents) {
      expect(agent.handledEvents.length, `${agent.name} handles events`).toBeGreaterThan(0);
      expect(agent.stateVisibleEffects.length, `${agent.name} declares state-visible effects`).toBeGreaterThan(0);
      expect(agent.stateVisibleEffects, `${agent.name} cannot rely only on run logging`).not.toEqual(['admin_agent_run']);
      expect(String(agent.run), `${agent.name} must not be the old placeholder implementation`)
        .not.toContain('registered but has no autonomous write path');
    }
  });

  it('treats zero-outcome non-skipped results as not complete', () => {
    expect(hasAmauraStateVisibleOutcome({
      actionsTaken: 0,
      notificationsCreated: 0,
      cardsCreated: 0,
      conceptsUpdated: 0,
      missionInvalidated: false,
      skipped: false,
      skipReason: null,
      aiCallsUsed: 0,
    })).toBe(false);

    expect(hasAmauraStateVisibleOutcome({
      actionsTaken: 1,
      notificationsCreated: 0,
      cardsCreated: 0,
      conceptsUpdated: 0,
      missionInvalidated: false,
      skipped: false,
      skipReason: null,
      aiCallsUsed: 0,
    })).toBe(true);
  });
});
