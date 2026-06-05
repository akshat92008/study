import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AMAURA_CONSUMERS,
  getAmauraAgentForConsumer,
  getAmauraRuntimeMap,
  getEnabledAmauraAgents,
  isAmauraConsumer,
} from '@/lib/amaura/agents/registry';

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
      'AtlasAgent',
      'AutopsyCascadeAgent',
      'BudgetAgent',
      'ForgettingAgent',
      'MemoryAgent',
      'MissionAgent',
      'PatternMemoryAgent',
      'PracticePatternAgent',
      'SessionCloseAgent',
      'StagnationAgent',
    ].sort());

    expect(getEnabledAmauraAgents().map((agent) => agent.name)).toContain('PracticePatternAgent');
    vi.stubEnv('ENABLE_AGENT_RUNTIME', 'false');
    expect(getEnabledAmauraAgents()).toEqual([]);
  });
});
