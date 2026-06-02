import { logger } from '@/lib/utils/logger';
import type { CheapAgentAction, CheapAgentCycleResult, LearningEvent } from './cheap-types';
import { executeAgentActions } from './action-executor';
import { runAtlasRuleAgent } from './rule-agents/atlas-rule-agent';
import { runAutopsyRuleAgent } from './rule-agents/autopsy-rule-agent';
import { runCommandRuleAgent } from './rule-agents/command-rule-agent';
import { runMemoryRuleAgent } from './rule-agents/memory-rule-agent';
import { runPulseRuleAgent } from './rule-agents/pulse-rule-agent';
import { runRevisionRuleAgent } from './rule-agents/revision-rule-agent';
import { isLearningSignal } from './rule-agents/helpers';

type RuleAgent = (event: LearningEvent) => CheapAgentAction[];

const RULE_AGENTS: Array<{ name: string; run: RuleAgent }> = [
  { name: 'MEMORY', run: runMemoryRuleAgent },
  { name: 'ATLAS', run: runAtlasRuleAgent },
  { name: 'AUTOPSY', run: runAutopsyRuleAgent },
  { name: 'REVISION', run: runRevisionRuleAgent },
  { name: 'COMMAND', run: runCommandRuleAgent },
  { name: 'PULSE', run: runPulseRuleAgent },
];

export type { LearningEvent };

export async function runCheapAgenticCycle(event: LearningEvent): Promise<CheapAgentCycleResult> {
  const empty: CheapAgentCycleResult = {
    applied: 0,
    proposed: 0,
    skipped: 0,
    failed: 0,
    actions: [],
  };

  if (!event.userId) {
    return {
      ...empty,
      skipped: 1,
      actions: [{ agent: 'system', actionType: 'cheap_agentic_cycle', status: 'skipped', reason: 'Event lacks userId.' }],
    };
  }

  if (!isLearningSignal(event)) return empty;

  const actions: CheapAgentAction[] = [];
  let ruleFailures = 0;

  for (const agent of RULE_AGENTS) {
    try {
      actions.push(...agent.run(event));
    } catch (error) {
      ruleFailures++;
      logger.warn('Cheap rule agent failed without aborting cycle', {
        agent: agent.name,
        eventId: event.id,
        eventType: event.type,
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (actions.length === 0) {
    return {
      ...empty,
      failed: ruleFailures,
      actions: ruleFailures
        ? [{ agent: 'system', actionType: 'cheap_agentic_cycle', status: 'failed', reason: 'One or more rule agents failed.' }]
        : [],
    };
  }

  const executed = await executeAgentActions(actions);
  executed.failed += ruleFailures;
  if (ruleFailures > 0) {
    executed.actions.push({
      agent: 'system',
      actionType: 'cheap_agentic_cycle',
      status: 'failed',
      reason: `${ruleFailures} rule agent(s) failed before action execution.`,
    });
  }
  return executed;
}
