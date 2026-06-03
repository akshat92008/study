// lib/ai/output-limits.ts
// Guards against massive generation requests that would lock up the router,
// exceed token budgets, or result in incomplete responses.
//
// Determines when a request should be processed synchronously vs
// queued for background generation.

import {
  getAiCostMode,
  getMaxSyncMcqCount,
  getMaxSyncFlashcardCount,
  getMaxSyncMockTestQuestions,
  type AiCostMode
} from './cost-mode';
import type { AiTask } from './token-budget';
import { logger } from '@/lib/utils/logger';

export interface OutputLimitCheck {
  allowed: boolean;
  cappedCount?: number;
  shouldQueue: boolean;
  queueReason?: string;
  degradedResponse?: string;
}

/**
 * Checks if a requested generation count is allowed synchronously.
 * If too large, suggests a capped count or queues the job.
 */
export function checkOutputLimit(
  task: AiTask,
  requestedCount: number,
  mode?: AiCostMode
): OutputLimitCheck {
  const costMode = mode ?? getAiCostMode();

  // 1. Document Generation (MCQs)
  if (task === 'document_generation' || task === 'json') {
    // If it looks like a mock test
    const mockTestLimit = getMaxSyncMockTestQuestions();
    if (requestedCount >= mockTestLimit) {
      logger.info('[OutputLimits] Queueing large mock test', { requestedCount, mockTestLimit });
      return {
        allowed: false,
        shouldQueue: true,
        queueReason: `Requests for ${requestedCount} questions must be generated in the background.`,
        degradedResponse: `Generating ${requestedCount} questions takes some time. I'm queueing this up as a background job for you.`
      };
    }

    const syncLimit = getMaxSyncMcqCount();
    if (requestedCount > syncLimit) {
      // In ultra_cheap, we strictly cap to syncLimit if they ask for e.g. 15 questions
      if (costMode === 'ultra_cheap') {
        logger.info('[OutputLimits] Capping sync MCQ request', { requestedCount, syncLimit, mode: costMode });
        return {
          allowed: true, // We allow it, but we expect the caller to use cappedCount
          cappedCount: syncLimit,
          shouldQueue: false,
        };
      }
      
      // In cheap/balanced, if it's over sync but under mockTest limit, we allow it
      // but warn it might be slow.
    }
  }

  // 2. Flashcards
  if (task === 'flashcards') {
    const syncLimit = getMaxSyncFlashcardCount();
    if (requestedCount > syncLimit * 2) { // Extremely large request
       return {
         allowed: false,
         shouldQueue: true,
         queueReason: `Requests for ${requestedCount} flashcards must be generated in the background.`,
         degradedResponse: `Generating ${requestedCount} flashcards takes some time. I'm queueing this up as a background job for you.`
       };
    }
    
    if (requestedCount > syncLimit) {
      if (costMode === 'ultra_cheap') {
         return {
           allowed: true,
           cappedCount: syncLimit,
           shouldQueue: false,
         };
      }
    }
  }

  return { allowed: true, shouldQueue: false };
}
