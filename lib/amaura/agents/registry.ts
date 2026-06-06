import {
  AutopsyCascadeAgent,
  ForgettingAgent,
  PatternMemoryAgent,
  PracticePatternAgent,
  SessionCloseAgent,
  StagnationAgent,
  NATIVE_AMAURA_AGENTS,
} from './native-agents';
import { BudgetAgent } from './budget';
import type { AmauraAgentDefinition, AmauraAgentName } from './types';

export const AMAURA_CONSUMERS = [
  'amaura_practice_agent',
  'amaura_session_agent',
  'amaura_autopsy_cascade',
  'amaura_forgetting_agent',
  'amaura_stagnation_agent',
  'amaura_pattern_memory',
] as const;

export type AmauraConsumer = typeof AMAURA_CONSUMERS[number];

const CONSUMER_AGENT_MAP: Record<AmauraConsumer, AmauraAgentDefinition<any>> = {
  amaura_practice_agent: PracticePatternAgent,
  amaura_session_agent: SessionCloseAgent,
  amaura_autopsy_cascade: AutopsyCascadeAgent,
  amaura_forgetting_agent: ForgettingAgent,
  amaura_stagnation_agent: StagnationAgent,
  amaura_pattern_memory: PatternMemoryAgent,
};

export function isAmauraConsumer(value: string): value is AmauraConsumer {
  return (AMAURA_CONSUMERS as readonly string[]).includes(value);
}

export function getAmauraAgentForConsumer(consumer: string) {
  if (!isAmauraConsumer(consumer)) return null;
  return CONSUMER_AGENT_MAP[consumer];
}

export function getEnabledAmauraAgents() {
  if (process.env.ENABLE_AGENT_RUNTIME === 'false') return [];
  return [...NATIVE_AMAURA_AGENTS];
}

export function getAmauraAgentByName(name: AmauraAgentName) {
  return NATIVE_AMAURA_AGENTS.find((agent) => agent.name === name) ?? null;
}

export function getAmauraRuntimeMap() {
  return {
    PracticePatternAgent,
    AutopsyCascadeAgent,
    SessionCloseAgent,
    ForgettingAgent,
    StagnationAgent,
    PatternMemoryAgent,
    BudgetAgent,
  };
}
