// lib/hermes/agents/mistake-agent.ts
// HERMES MISTAKE AGENT — Primary production agent.
//
// Diagnoses WHY a learner was wrong, identifies weak concepts,
// generates targeted revision cards, and suggests next action.
//
// This agent is called from the manual autopsy route.
// It must NEVER appear in user-facing UI or error messages.
//
// Fallback: if Hermes is disabled or fails, a deterministic fallback
// generates minimal but usable output from the raw Q/A/explanation.

import { runHermesJSON } from '../hermes-client';
import { HermesMistakeResultSchema } from '../schemas/mistake.schema';
import {
  HERMES_MISTAKE_SYSTEM_PROMPT,
  buildMistakeUserPrompt,
} from '../hermes-prompts';
import type {
  HermesMistakeInput,
  HermesMistakeResult,
  HermesCard,
} from '../hermes-types';
import { hermesLogger } from '../hermes-logger';
import { featureToModelTier } from '../hermes-budget';
import { truncate, compactArray } from '../hermes-internal-utils';

/**
 * Run the Hermes Mistake Agent.
 *
 * Returns a full HermesMistakeResult on success.
 * Throws HermesDisabledError | HermesAgentError | HermesSchemaError | HermesTimeoutError on failure.
 * Callers must handle all errors and apply fallback.
 */
export async function runHermesMistakeAgent(
  input: HermesMistakeInput
): Promise<HermesMistakeResult> {
  const userPrompt = buildMistakeUserPrompt({
    question: truncate(input.question, 2000),
    myAnswer: truncate(input.myAnswer, 500),
    correctAnswer: truncate(input.correctAnswer, 500),
    explanation: input.explanation ? truncate(input.explanation, 800) : null,
    goalTitle: input.goalTitle ?? null,
    subjectHint: input.subjectHint ?? null,
    recentWeakConcepts: compactArray(input.recentWeakConcepts, 5),
  });

  hermesLogger.info('Mistake agent called', {
    userId: input.userId,
    goalId: input.goalId,
    chatSessionId: input.chatSessionId,
  });

  return runHermesJSON<HermesMistakeResult>({
    userId: input.userId,
    feature: 'hermes_mistake',
    route: '/api/autopsy/manual',
    systemPrompt: HERMES_MISTAKE_SYSTEM_PROMPT,
    userPrompt,
    schema: HermesMistakeResultSchema,
    modelTier: featureToModelTier('hermes_mistake'),
    metadata: {
      goalId: input.goalId ?? null,
      chatSessionId: input.chatSessionId ?? null,
    },
  });
}

/**
 * Deterministic fallback used when Hermes is disabled or fails.
 * Produces minimal but usable output from raw Q/A/explanation.
 * This ensures the manual autopsy route always returns something useful.
 */
export function buildMistakeFallback(
  input: Pick<
    HermesMistakeInput,
    'question' | 'myAnswer' | 'correctAnswer' | 'explanation'
  >
): HermesMistakeResult {
  const questionSnippet = input.question.slice(0, 100);
  const cards: HermesCard[] = [
    {
      front: `What is the correct answer to: ${questionSnippet}?`,
      back: input.correctAnswer.slice(0, 500),
      type: 'mistake_concept',
      difficulty: 'medium',
    },
    {
      front: `Why was "${input.myAnswer.slice(0, 100)}" wrong?`,
      back: input.explanation
        ? input.explanation.slice(0, 500)
        : `The correct answer is: ${input.correctAnswer.slice(0, 300)}`,
      type: 'error_pattern',
      difficulty: 'medium',
    },
    {
      front: `What should you check before answering a question like this?`,
      back: `Review the key concepts and eliminate obviously wrong options methodically.`,
      type: 'similar_trap',
      difficulty: 'easy',
    },
  ];

  return {
    category: 'unknown',
    subject: null,
    chapter: null,
    topic: null,
    diagnosis:
      'The system could not confidently diagnose the reasoning pattern. Review the question and correct answer carefully.',
    whyMyAnswerWasWrong:
      `Your answer "${input.myAnswer.slice(0, 100)}" was not correct for this question.`,
    whyCorrectAnswerWorks: input.explanation
      ? input.explanation.slice(0, 400)
      : `The correct answer is: ${input.correctAnswer.slice(0, 300)}`,
    keyMissedClue: null,
    confidence: 'low',
    weakConcept: {
      subject: null,
      chapter: null,
      topic: null,
      name: 'Unknown concept',
    },
    cards,
    nextAction: {
      label: 'Review generated revision cards',
      rationale: 'Active recall helps retention after a mistake.',
      estimatedMinutes: 5,
      actionType: 'review_cards',
    },
    safetyFlags: {
      possibleHallucination: false,
      needsHumanReview: true,
      reason: 'Fallback used — automatic diagnosis not available.',
    },
  };
}
