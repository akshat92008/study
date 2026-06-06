import {
  AutopsyCascadeAgent,
  ForgettingAgent,
  GoalDecomposerAgent,
  NextActionAgent,
  PlanAdapterAgent,
  PatternMemoryAgent,
  PracticePatternAgent,
  ProgressEvaluatorAgent,
  SessionCloseAgent,
  StagnationAgent,
  NATIVE_AMAURA_AGENTS,
} from './native-agents';
import {
  AMAURA_CONSUMERS,
  type AmauraConsumer,
} from '@/lib/amaura/events/event-matrix';
import { BudgetAgent } from './budget';
import type { AmauraAgentDefinition, AmauraAgentName } from './types';

export { AMAURA_CONSUMERS };
export type { AmauraConsumer };

const CONSUMER_AGENT_MAP: Record<AmauraConsumer, AmauraAgentDefinition<any>> = {
  amaura_goal_decomposer: GoalDecomposerAgent,
  amaura_plan_adapter: PlanAdapterAgent,
  amaura_progress_evaluator: ProgressEvaluatorAgent,
  amaura_next_action: NextActionAgent,
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
    GoalDecomposerAgent,
    PlanAdapterAgent,
    ProgressEvaluatorAgent,
    NextActionAgent,
    PracticePatternAgent,
    AutopsyCascadeAgent,
    SessionCloseAgent,
    ForgettingAgent,
    StagnationAgent,
    PatternMemoryAgent,
    BudgetAgent,
  };
}
