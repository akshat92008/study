// lib/hermes/agents/next-action-agent.ts
// HERMES NEXT-ACTION AGENT
//
// Generates one compact, goal-specific next action from structured state.
// Used ONLY inside COMMAND when deterministic fallback is weak.
// COMMAND remains deterministic-first: rules/database first,
// Hermes only to personalize wording or choose among candidates.

import { runHermesJSON } from '../hermes-client';
import { HermesNextActionResultSchema } from '../schemas/next-action.schema';
import {
  HERMES_NEXT_ACTION_SYSTEM_PROMPT,
  buildNextActionUserPrompt,
} from '../hermes-prompts';
import type { HermesNextActionInput, HermesNextActionResult } from '../hermes-types';
import { hermesLogger } from '../hermes-logger';
import { isHermesEnabled } from '../hermes-config';
import { HermesDisabledError } from '../hermes-errors';

export async function runHermesNextActionAgent(
  input: HermesNextActionInput
): Promise<HermesNextActionResult> {
  if (!isHermesEnabled()) {
    throw new HermesDisabledError();
  }

  const userPrompt = buildNextActionUserPrompt({
    goalTitle: input.goalTitle,
    weakConceptsCount: input.weakConceptsCount,
    dueCardsCount: input.dueCardsCount,
    recentMistakesCount: input.recentMistakesCount,
    pendingTasksCount: input.pendingTasksCount,
  });

  hermesLogger.info('Next-action agent called', {
    userId: input.userId,
    goalId: input.goalId,
  });

  return runHermesJSON<HermesNextActionResult>({
    userId: input.userId,
    feature: 'hermes_next_action',
    route: '/api/internal/hermes/next-action',
    systemPrompt: HERMES_NEXT_ACTION_SYSTEM_PROMPT,
    userPrompt,
    schema: HermesNextActionResultSchema,
    modelTier: 'fast',
    metadata: {
      goalId: input.goalId,
    },
  });
}
