// lib/engines/orchestrator.ts
import { IntentResult } from '@/lib/ai/chat-intent';
import { z } from 'zod';

/**
 * Types for orchestrator result as defined in the specification.
 */
export type OrchestratorResult = {
  intent: string; // direct_answer | solve_question | study_session | make_artifact | mock_autopsy | memory_review | progress_check | planning | emotional_support | unknown
  mode: string; // doubt | learning | workflow
  requiredWorkers: string[]; // e.g., ["autopsy"], ["command"], []
  shouldAnswerFirst: boolean;
  needsFileProcessing: boolean;
  riskLevel: 'low' | 'medium' | 'high';
};

/**
 * Pure routing function — takes a pre-classified intent and returns
 * the orchestration plan. No LLM call. O(1).
 *
 * Intent classification has already been done by classifyMessageCombined()
 * in the chat route. Passing it in here eliminates the second LLM call.
 */
export function orchestrateFromIntent(
  classifiedIntent: IntentResult | string,
  hasFiles: boolean,
  message?: string
): OrchestratorResult {
  const intent = typeof classifiedIntent === 'string' ? classifiedIntent : classifiedIntent.intent;
  const msg = message || '';

  if (hasFiles && ['AUTOPSY', 'ANALYTICS', 'ATLAS', 'FLASHCARDS'].includes(intent)) {
    return {
      intent: 'mock_autopsy',
      mode: 'workflow',
      requiredWorkers: ['autopsy'],
      shouldAnswerFirst: false,
      needsFileProcessing: true,
      riskLevel: 'medium',
    };
  } else if (intent === 'CREATE_ARTIFACT' || /plan|schedule|roadmap|study.*plan|microtarget|planner|dashboard|add.*task/i.test(msg)) {
    return {
      intent: 'planning',
      mode: 'workflow',
      requiredWorkers: ['command'],
      shouldAnswerFirst: false,
      needsFileProcessing: false,
      riskLevel: 'medium',
    };
  } else if (intent === 'REPLAN') {
    return {
      intent: 'memory_review',
      mode: 'workflow',
      requiredWorkers: [],
      shouldAnswerFirst: true,
      needsFileProcessing: false,
      riskLevel: 'low',
    };
  }

  return {
    intent: intent.toLowerCase() as any,
    mode: 'doubt',
    requiredWorkers: [],
    shouldAnswerFirst: true,
    needsFileProcessing: hasFiles,
    riskLevel: 'low',
  };
}

// Keep the async version as a shim so any other callers don't break.
// It now just calls orchestrateFromIntent with a dummy intent if needed.
export async function orchestrate(
  _userId: string,
  _message: string,
  _recentHistory: any[],
  hasFiles: boolean,
  preClassifiedIntent?: IntentResult | string
): Promise<OrchestratorResult> {
  if (preClassifiedIntent) {
    return orchestrateFromIntent(preClassifiedIntent, hasFiles, _message);
  }
  
  // Fallback for callers that don't pass preClassifiedIntent (shouldn't happen in practice)
  return {
    intent: 'direct_answer',
    mode: 'doubt',
    requiredWorkers: [],
    shouldAnswerFirst: true,
    needsFileProcessing: hasFiles,
    riskLevel: 'low',
  };
}
