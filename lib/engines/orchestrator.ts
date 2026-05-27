// lib/engines/orchestrator.ts
import { detectChatIntent } from '@/lib/ai/chat-intent';
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
 * Simple heuristic routing logic.
 * In a full implementation this would delegate to more sophisticated intent classification.
 */
export async function orchestrate(
  userId: string,
  message: string,
  recentHistory: any[],
  hasFiles: boolean
): Promise<OrchestratorResult> {
  // Detect intent using existing classifier.
  const intentResult = await detectChatIntent(message, recentHistory, '');
  const intent = intentResult.intent;

  // Default values.
  let orchestratorResult: OrchestratorResult = {
    intent: 'direct_answer',
    mode: 'doubt',
    requiredWorkers: [],
    shouldAnswerFirst: true,
    needsFileProcessing: hasFiles,
    riskLevel: 'low',
  };

  // Routing rules.
  if (hasFiles && ['AUTOPSY', 'ANALYTICS', 'ATLAS', 'FLASHCARDS'].includes(intent)) {
    orchestratorResult = {
      intent: 'mock_autopsy',
      mode: 'workflow',
      requiredWorkers: ['autopsy'],
      shouldAnswerFirst: false,
      needsFileProcessing: true,
      riskLevel: 'medium',
    };
  } else if (intent === 'CREATE_ARTIFACT' || /plan|schedule|roadmap|study.*plan/i.test(message)) {
    orchestratorResult = {
      intent: 'planning',
      mode: 'workflow',
      requiredWorkers: ['command'],
      shouldAnswerFirst: false,
      needsFileProcessing: false,
      riskLevel: 'medium',
    };
  } else if (intent === 'REPLAN') {
    orchestratorResult = {
      intent: 'memory_review',
      mode: 'workflow',
      requiredWorkers: [],
      shouldAnswerFirst: true,
      needsFileProcessing: false,
      riskLevel: 'low',
    };
  } else {
    // Fallback to direct answer using detected intent as a hint.
    orchestratorResult = {
      intent: intent.toLowerCase() as any,
      mode: 'doubt',
      requiredWorkers: [],
      shouldAnswerFirst: true,
      needsFileProcessing: hasFiles,
      riskLevel: 'low',
    };
  }

  return orchestratorResult;
}
