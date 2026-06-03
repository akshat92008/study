// lib/hermes/agents/trace-agent.ts
// HERMES TRACE AGENT
//
// Analyzes recent learning events to detect cognitive patterns.
// NOT called on every request — only on scheduled/triggered analysis:
//   - After 3+ mistakes in a goal
//   - Daily/weekly worker
//   - Before session card generation if cache expired
//
// Results feed back into COMMAND suggestions (deterministic first).

import { runHermesJSON } from '../hermes-client';
import { HermesTraceResultSchema } from '../schemas/trace.schema';
import {
  HERMES_TRACE_SYSTEM_PROMPT,
  buildTraceUserPrompt,
} from '../hermes-prompts';
import type { HermesTraceInput, HermesTraceResult } from '../hermes-types';
import { hermesLogger } from '../hermes-logger';
import { isHermesEnabled } from '../hermes-config';
import { HermesDisabledError } from '../hermes-errors';

export async function runHermesTraceAgent(
  input: HermesTraceInput
): Promise<HermesTraceResult> {
  if (!isHermesEnabled()) {
    throw new HermesDisabledError();
  }

  const userPrompt = buildTraceUserPrompt({
    goalTitle: `Goal ${input.goalId}`,
    recentMistakes: input.recentMistakes,
    dueCardsCount: input.dueCardsCount,
    weakConceptsCount: input.weakConceptsCount,
  });

  hermesLogger.info('Trace agent called', {
    userId: input.userId,
    goalId: input.goalId,
    recentMistakeCount: input.recentMistakes.length,
  });

  return runHermesJSON<HermesTraceResult>({
    userId: input.userId,
    feature: 'hermes_trace',
    route: '/api/internal/hermes/trace',
    systemPrompt: HERMES_TRACE_SYSTEM_PROMPT,
    userPrompt,
    schema: HermesTraceResultSchema,
    modelTier: 'fast',
    metadata: {
      goalId: input.goalId,
    },
  });
}
