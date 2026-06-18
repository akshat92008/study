import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentChannel, LearningSignal } from '@/lib/agent/types';
import { projectLearningSignal } from '@/lib/learner-state/projector';
import { resolveActiveGoalForUser } from '@/lib/goals/resolve-active-goal';
import { stableKey } from '@/lib/agent/tools/learning/common';
import { CognitionError, type CognitionErrorCode, toCognitionError } from '@/lib/errors/cognition-errors';
import {
  createCoreLoopTrace,
  finishCoreLoopTrace,
  recordCoreLoopStep,
} from '@/lib/core-loop/trace';

export type LearningEventInput = {
  userId: string;
  goalId: string | null;
  source: 'chat_practice' | 'focus_session' | 'autopsy' | 'manual_review' | 'revision';
  concept: {
    conceptId?: string;
    canonicalName?: string;
    subject?: string;
    chapter?: string;
    topic?: string;
  };
  result: {
    outcome: 'correct' | 'incorrect' | 'partial' | 'skipped' | 'reviewed' | 'completed';
    confidence?: number;
    difficulty?: number;
    mistakeType?: string;
    explanation?: string;
  };
  artifact?: {
    chatMessageId?: string;
    practiceSetId?: string;
    practiceItemId?: string;
    autopsyAssessmentId?: string;
    autopsyQuestionId?: string;
    sourceMaterialId?: string;
    sessionCardId?: string;
  };
  metadata?: Record<string, unknown>;
};

export type LearningEventResult = {
  ok: true;
  learningEventId: string;
  goalId: string | null;
  conceptId: string | null;
  masteryBefore: number | null;
  masteryAfter: number | null;
  revisionCardIds: string[];
  mistakeIds: string[];
  sessionCardInvalidated: boolean;
  dashboardShouldRefresh: boolean;
  traceId: string;
};

export type LearningEventError = {
  ok: false;
  code:
    | 'AUTH_REQUIRED'
    | 'GOAL_NOT_FOUND'
    | 'CONCEPT_RESOLUTION_FAILED'
    | 'EVENT_WRITE_FAILED'
    | 'MASTERY_UPDATE_FAILED'
    | 'REVISION_UPDATE_FAILED'
    | 'MISTAKE_WRITE_FAILED'
    | 'SESSION_UPDATE_FAILED'
    | 'EVENT_PUBLISH_FAILED';
  message: string;
  recoverable: boolean;
  traceId: string;
};

function channelForSource(source: LearningEventInput['source']): AgentChannel {
  if (source === 'chat_practice') return 'practice';
  if (source === 'focus_session') return 'session';
  if (source === 'autopsy') return 'autopsy';
  return 'revision';
}

function signalTypeForOutcome(outcome: LearningEventInput['result']['outcome']): LearningSignal['type'] {
  if (outcome === 'correct') return 'concept_understood';
  if (outcome === 'incorrect' || outcome === 'skipped') return 'weak_area_detected';
  if (outcome === 'partial') return 'misconception_detected';
  if (outcome === 'reviewed') return 'revision_reviewed';
  return 'session_completed';
}

function normalizeErrorCode(code: CognitionErrorCode): LearningEventError['code'] {
  if (code === 'MEMORY_UPDATE_FAILED') return 'REVISION_UPDATE_FAILED';
  if (
    code === 'AUTH_REQUIRED' ||
    code === 'GOAL_NOT_FOUND' ||
    code === 'CONCEPT_RESOLUTION_FAILED' ||
    code === 'EVENT_WRITE_FAILED' ||
    code === 'MASTERY_UPDATE_FAILED' ||
    code === 'REVISION_UPDATE_FAILED' ||
    code === 'MISTAKE_WRITE_FAILED' ||
    code === 'SESSION_UPDATE_FAILED' ||
    code === 'EVENT_PUBLISH_FAILED'
  ) return code;
  return 'EVENT_WRITE_FAILED';
}

export async function applyLearningEvent(
  supabase: SupabaseClient,
  input: LearningEventInput,
  options: { context?: import('@/lib/agent/types').AgentToolContext; traceId?: string } = {}
): Promise<LearningEventResult | LearningEventError> {
  const trace = createCoreLoopTrace({
    userId: input.userId,
    goalId: input.goalId,
    action: `apply_learning_event:${input.source}`,
    traceId: options.traceId ?? options.context?.runId ?? undefined,
  });

  try {
    if (!input.userId) throw new CognitionError('AUTH_REQUIRED', 'Authentication is required.');
    recordCoreLoopStep(trace, { name: 'validate_user', status: 'success' });

    const goalResolution = await resolveActiveGoalForUser(supabase, input.userId, input.goalId);
    const goalId = goalResolution.goalId;
    trace.goalId = goalId;
    recordCoreLoopStep(trace, {
      name: 'resolve_goal',
      status: 'success',
      outputSummary: { goalId, source: goalResolution.source },
    });

    const conceptName = input.concept.canonicalName?.trim() || input.concept.topic?.trim() || null;
    if (conceptName && /placeholder_microtarget/i.test(conceptName)) {
      throw new CognitionError('CONCEPT_RESOLUTION_FAILED', 'Cannot record learning events against placeholder topics.');
    }

    const idempotencyKey = String(
      input.metadata?.idempotencyKey ?? stableKey([
        'learning-event',
        input.userId,
        input.source,
        input.artifact?.practiceItemId,
        input.artifact?.autopsyQuestionId,
        input.artifact?.sessionCardId,
        conceptName,
        input.result.outcome,
      ])
    );

    const signal: LearningSignal = {
      type: signalTypeForOutcome(input.result.outcome),
      concept: conceptName ?? undefined,
      canonicalConcept: conceptName ?? undefined,
      subject: input.concept.subject ?? null,
      chapter: input.concept.chapter ?? null,
      topic: input.concept.topic ?? conceptName,
      confidence: input.result.confidence ?? 0.8,
      source: channelForSource(input.source),
      correct: input.result.outcome === 'correct',
      evidence: input.result.explanation ?? `${input.source} outcome: ${input.result.outcome}`,
      materialId: input.artifact?.sourceMaterialId,
      metadata: {
        ...input.metadata,
        ...input.artifact,
        conceptId: input.concept.conceptId,
        goalId,
        outcome: input.result.outcome,
        difficulty: input.result.difficulty,
        mistakeType: input.result.mistakeType,
        idempotencyKey,
      },
    };

    const projection = await projectLearningSignal(supabase, input.userId, signal, {
      goalId,
      context: options.context,
      traceId: trace.traceId,
    });
    if (!projection.success) {
      const first = projection.errors?.[0];
      throw new CognitionError(
        (first?.code as CognitionErrorCode | undefined) ?? 'LEARNING_EVENT_FAILED',
        first?.message ?? 'Learner state could not be updated.',
        true,
        trace.traceId
      );
    }
    recordCoreLoopStep(trace, {
      name: 'project_learner_state',
      status: 'success',
      outputSummary: {
        learningEventId: projection.learningEventId,
        conceptId: projection.conceptId,
        masteryBefore: projection.masteryBefore,
        masteryAfter: projection.masteryAfter,
        revisionCardIds: projection.revisionCardIds,
        mistakeIds: projection.mistakeIds,
      },
    });

    // Event publishing is now handled atomically via the Outbox pattern in the projection RPC.
    const result: LearningEventResult = {
      ok: true,
      learningEventId: projection.learningEventId ?? idempotencyKey,
      goalId,
      conceptId: projection.conceptId ?? null,
      masteryBefore: projection.masteryBefore ?? null,
      masteryAfter: projection.masteryAfter ?? null,
      revisionCardIds: projection.revisionCardIds ?? [],
      mistakeIds: projection.mistakeIds ?? [],
      sessionCardInvalidated: projection.invalidationTriggered,
      dashboardShouldRefresh: true,
      traceId: trace.traceId,
    };
    await finishCoreLoopTrace(trace, result as unknown as Record<string, unknown>, supabase);
    return result;
  } catch (error) {
    const cognitionError = toCognitionError(error, 'LEARNING_EVENT_FAILED', 'Learner state could not be updated.', trace.traceId);
    const result: LearningEventError = {
      ok: false,
      code: normalizeErrorCode(cognitionError.code),
      message: cognitionError.message,
      recoverable: cognitionError.retryable,
      traceId: trace.traceId,
    };
    recordCoreLoopStep(trace, {
      name: 'apply_learning_event',
      status: 'failed',
      errorCode: result.code,
      outputSummary: { message: result.message },
    });
    await finishCoreLoopTrace(trace, result as unknown as Record<string, unknown>, supabase);
    return result;
  }
}
