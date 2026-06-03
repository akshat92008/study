// lib/hermes/agents/revision-agent.ts
// HERMES REVISION QUALITY AGENT
//
// Improves low-quality generated cards. Optional — not called in initial
// mistake route to avoid doubling cost. Built for future use.
//
// Enable by calling explicitly when card quality improvement is needed.

import { runHermesJSON } from '../hermes-client';
import { HermesRevisionResultSchema } from '../schemas/revision.schema';
import type { HermesRevisionInput, HermesRevisionResult } from '../hermes-types';
import { hermesLogger } from '../hermes-logger';
import { isHermesEnabled } from '../hermes-config';
import { HermesDisabledError } from '../hermes-errors';

const REVISION_SYSTEM_PROMPT = `You are Hermes, an internal learning-reasoning worker. You improve draft revision cards for quality and pedagogical effectiveness. Return strict JSON only. No markdown.`;

export async function runHermesRevisionAgent(
  input: HermesRevisionInput
): Promise<HermesRevisionResult> {
  if (!isHermesEnabled()) {
    throw new HermesDisabledError();
  }

  const userPrompt = `Improve these ${input.draftCards.length} draft revision cards.
Context: ${input.context.slice(0, 500)}

Draft cards:
${JSON.stringify(input.draftCards.slice(0, 10), null, 2)}

Return JSON: improvedCards (same schema), rejectedCount, reason.
Rules: Remove duplicate/trivial cards. Improve clarity. Make fronts testable questions.`;

  hermesLogger.info('Revision agent called', {
    userId: input.userId,
    goalId: input.goalId,
    draftCount: input.draftCards.length,
  });

  return runHermesJSON<HermesRevisionResult>({
    userId: input.userId,
    feature: 'hermes_revision',
    route: '/api/internal/hermes/revision',
    systemPrompt: REVISION_SYSTEM_PROMPT,
    userPrompt,
    schema: HermesRevisionResultSchema,
    modelTier: 'fast',
  });
}
