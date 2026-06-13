import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { stableKey } from '@/lib/agent/tools/learning/common';
import { applyLearningEvent, type LearningEventResult } from '@/lib/learner-state/apply-learning-event';
import { CognitionError } from '@/lib/errors/cognition-errors';

export interface ProjectAutopsyV3Input {
  userId: string;
  assessmentId: string;
  reportId: string;
  report: any;
  diagnoses: any[];
  goalId?: string | null;
  subject?: string | null;
  /**
   * Phase 8.2: Accept the caller's Supabase client instead of creating a new one.
   * This ensures the projection uses the authenticated route client and avoids
   * permission/auth context mismatch.
   */
  supabase?: SupabaseClient;
}

const INVALID_TOPICS = new Set(['unknown', 'n/a', 'not applicable', 'none']);

/**
 * Project Autopsy V3 results via the central projector.
 * Ensures consistent ATLAS, MEMORY, and event state.
 *
 * Phase 8.2 changes:
 * - Accepts `supabase` client from caller (no internal createClient)
 * - Uses stable idempotency key per diagnosis: autopsy_v3:diagnosis:{assessmentId}:{questionId}:{canonicalConcept}
 * - Date.now() is NOT included in any idempotency key
 */
export async function projectAutopsyV3Results(input: ProjectAutopsyV3Input) {
  // Phase 8.2: Use caller-provided client; fall back to server client only when called outside a route context.
  let supabase: SupabaseClient;
  if (input.supabase) {
    supabase = input.supabase;
  } else {
    const { createClient } = await import('@/lib/supabase/server');
    supabase = await createClient();
    logger.warn('projectAutopsyV3Results: no supabase client provided — falling back to server client', {
      userId: input.userId,
      assessmentId: input.assessmentId,
    });
  }

  const { userId, assessmentId, reportId, diagnoses, goalId, subject } = input;

  logger.info('Projecting Autopsy V3 results via central projector', { userId, assessmentId, reportId });

  if (diagnoses.length === 0) {
    throw new CognitionError('AUTOPSY_PROJECTION_FAILED', 'Autopsy cannot be projected without at least one diagnosis.');
  }

  // 1. Project individual mistakes with stable, dedupe-safe idempotency keys
  const results: LearningEventResult[] = [];
  for (const diagnosis of diagnoses) {
    const canonicalConcept = (diagnosis.topic || 'unspecified').trim().toLowerCase();

    if (INVALID_TOPICS.has(canonicalConcept)) {
      logger.info('Skipping projection for invalid topic', { topic: diagnosis.topic, assessmentId });
      continue;
    }

    // Phase 8.2: Stable idempotency key — never includes Date.now()
    const diagnosisIdempotencyKey = stableKey([
      'autopsy_v3',
      'diagnosis',
      assessmentId,
      String(diagnosis.question_id || 'no_qid'),
      canonicalConcept,
    ]);

    const res = await applyLearningEvent(supabase, {
      userId,
      goalId: goalId ?? null,
      source: 'autopsy',
      concept: {
        canonicalName: diagnosis.topic,
        subject: diagnosis.subject || subject || undefined,
        chapter: diagnosis.topic,
        topic: diagnosis.topic,
      },
      result: {
        outcome: diagnosis.status === 'skipped' ? 'skipped' : 'incorrect',
        confidence: diagnosis.confidence || 0.8,
        mistakeType: diagnosis.mistake_type,
        explanation: diagnosis.ai_analysis || `Autopsy mistake: ${diagnosis.mistake_type} on ${diagnosis.topic}`,
      },
      artifact: {
        autopsyAssessmentId: assessmentId,
        autopsyQuestionId: diagnosis.question_id,
      },
      metadata: {
        severity: diagnosis.severity === 'high' ? 5 : diagnosis.severity === 'medium' ? 3 : 1,
        mistakeText: diagnosis.ai_analysis || diagnosis.mistake_type,
        questionText: diagnosis.question_text,
        userAnswer: diagnosis.user_answer,
        correctAnswer: diagnosis.correct_answer,
        whyWrong: diagnosis.ai_analysis,
        goalId,
        idempotencyKey: diagnosisIdempotencyKey,
      },
    });
    if (!res.ok) {
      throw new CognitionError('AUTOPSY_PROJECTION_FAILED', res.message, res.recoverable, res.traceId);
    }
    results.push(res);
  }

  if (results.length === 0) {
    throw new CognitionError('AUTOPSY_PROJECTION_FAILED', 'Autopsy contained no classified, recoverable diagnoses.');
  }

  return {
    mistakesProjected: results.length,
    success: true,
  };
}
