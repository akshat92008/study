/**
 * Canonical learning transaction wrapper.
 *
 * Existing chat/upload/session callers still enter here, but all meaningful
 * learner state mutation now runs through the verified Cognition agent runtime.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { runHermesTurn } from '@/lib/agent/runtime';
import type { AgentChannel, MutationSummary } from '@/lib/agent/types';

export type TransactionSource =
  | 'typed_doubt'
  | 'quiz_attempt'
  | 'photo_doubt'
  | 'pdf_upload'
  | 'autopsy_upload'
  | 'manual_mistake'
  | 'session_completion';

export interface LearningTransactionInput {
  supabase: SupabaseClient;
  userId: string;
  source: TransactionSource;
  idempotencyKey?: string;
  sessionId?: string | null;
  goalId?: string | null;
  userText?: string | null;
  assistantText?: string | null;
  retrievedChunks?: any[];
  payload?: Record<string, unknown>;
  imageMetadata?: Record<string, unknown> | null;
  pdfMetadata?: Record<string, unknown> | null;
  quizAttempt?: Record<string, unknown> | null;
  mistakes?: unknown[];
  context?: Record<string, unknown>;
}

export interface LearningTransactionResult {
  ok: boolean;
  mutationSummary: MutationSummary;
  learningSignalSummary: string;
  trajectoryId?: string;
  verification?: Record<string, unknown>;
}

function channelForSource(source: TransactionSource): AgentChannel {
  switch (source) {
    case 'quiz_attempt':
      return 'practice';
    case 'autopsy_upload':
    case 'manual_mistake':
      return 'autopsy';
    case 'session_completion':
      return 'session';
    default:
      return 'chat';
  }
}

function emptyMutationSummary(warning: string): MutationSummary {
  return {
    changed: false,
    eventsWritten: 0,
    conceptsCreated: 0,
    conceptsUpdated: 0,
    revisionCardsCreated: 0,
    microtargetsUpdated: 0,
    practiceAttemptsProcessed: 0,
    sessionsCompleted: 0,
    mistakesRecorded: 0,
    warnings: [warning],
  };
}

export async function processLearningTransaction(
  input: LearningTransactionInput
): Promise<LearningTransactionResult> {
  try {
    const runtime = await runHermesTurn({
      userId: input.userId,
      channel: channelForSource(input.source),
      userMessage: input.userText ?? '',
      payload: {
        ...(input.payload ?? {}),
        ...(input.imageMetadata ? { imageMetadata: input.imageMetadata } : {}),
        ...(input.pdfMetadata ? { pdfMetadata: input.pdfMetadata } : {}),
        ...(input.quizAttempt ? { quizAttempt: input.quizAttempt } : {}),
        ...(input.mistakes ? { mistakes: input.mistakes } : {}),
        ...(input.context ? { context: input.context } : {}),
        retrievedChunks: input.retrievedChunks ?? [],
      },
      sessionId: input.sessionId ?? undefined,
      goalId: input.goalId ?? undefined,
    }, {
      supabase: input.supabase,
      idempotencyKey: input.idempotencyKey,
      finalResponse: input.assistantText ?? undefined,
    });

    const verified = runtime.verification.ok;
    if (verified) {
      await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
        client: input.supabase,
        goalId: input.goalId ?? null,
      });
    }
    return {
      ok: verified,
      mutationSummary: runtime.mutationSummary,
      learningSignalSummary: buildSignalSummary(runtime.mutationSummary, verified),
      trajectoryId: runtime.trajectoryId,
      verification: runtime.verification as any,
    };
  } catch (error) {
    logger.error('Learning transaction failed', error, {
      userId: input.userId,
      source: input.source,
    });
    return {
      ok: false,
      mutationSummary: emptyMutationSummary('Transaction failed'),
      learningSignalSummary: '',
    };
  }
}

function buildSignalSummary(summary: MutationSummary, verified: boolean): string {
  if (!verified) return '';
  const parts: string[] = [];
  if (summary.conceptsCreated > 0) parts.push(`${summary.conceptsCreated} topic${summary.conceptsCreated > 1 ? 's' : ''} tracked`);
  if (summary.conceptsUpdated > 0) parts.push('ATLAS updated');
  if (summary.revisionCardsCreated > 0) parts.push(`${summary.revisionCardsCreated} MEMORY card${summary.revisionCardsCreated > 1 ? 's' : ''} created`);
  if (summary.microtargetsUpdated > 0) parts.push('mission progress updated');
  if (summary.practiceAttemptsProcessed > 0) parts.push('practice processed');
  if (summary.sessionsCompleted > 0) parts.push('session completed');
  return parts.join(' | ');
}
