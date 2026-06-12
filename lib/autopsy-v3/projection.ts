import { SupabaseClient } from '@supabase/supabase-js';
import { projectLearningSignal, type ProjectionResult } from '@/lib/learner-state/projector';
import { logger } from '@/lib/utils/logger';
import { stableKey } from '@/lib/agent/tools/learning/common';
import type { LearningSignal } from '@/lib/agent/types';

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

  const { userId, assessmentId, reportId, report, diagnoses, goalId, subject } = input;

  logger.info('Projecting Autopsy V3 results via central projector', { userId, assessmentId, reportId });

  // 1. Project individual mistakes with stable, dedupe-safe idempotency keys
  const results: ProjectionResult[] = [];
  for (const diagnosis of diagnoses) {
    const canonicalConcept = (diagnosis.topic || 'unknown').trim().toLowerCase();

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

    const mistakeSignal: LearningSignal = {
      type: 'autopsy_mistake_detected',
      concept: diagnosis.topic,
      canonicalConcept,
      subject: diagnosis.subject || subject || 'General',
      chapter: diagnosis.topic,
      topic: diagnosis.topic,
      confidence: diagnosis.confidence || 0.8,
      source: 'autopsy',
      evidence: diagnosis.ai_analysis || `Autopsy mistake: ${diagnosis.mistake_type} on ${diagnosis.topic}`,
      metadata: {
        assessmentId,
        questionId: diagnosis.question_id,
        mistakeType: diagnosis.mistake_type,
        severity: diagnosis.severity === 'high' ? 5 : diagnosis.severity === 'medium' ? 3 : 1,
        mistakeText: diagnosis.ai_analysis || diagnosis.mistake_type,
        questionText: diagnosis.question_text,
        userAnswer: diagnosis.user_answer,
        correctAnswer: diagnosis.correct_answer,
        whyWrong: diagnosis.ai_analysis,
        goalId,
        // Pass stable key so projector can use it for idempotency
        idempotencyKey: diagnosisIdempotencyKey,
      },
    };

    const res = await projectLearningSignal(supabase, userId, mistakeSignal, { goalId });
    results.push(res);
  }

  // 2. Project overall assessment result signal with stable key
  const assessmentIdempotencyKey = stableKey([
    'autopsy_v3',
    'assessment_complete',
    assessmentId,
    reportId,
  ]);

  const assessmentSignal: LearningSignal = {
    type: 'concept_practiced', // General progress signal
    confidence: 0.9,
    source: 'autopsy',
    evidence: `Completed Deep Autopsy assessment: ${report.summaryText || report.overview?.summaryText || ''}`,
    metadata: {
      assessmentId,
      reportId,
      score: report.overview?.score,
      totalMarks: report.overview?.totalMarks,
      goalId,
      idempotencyKey: assessmentIdempotencyKey,
    },
  };

  await projectLearningSignal(supabase, userId, assessmentSignal, { goalId });

  return {
    mistakesProjected: results.length,
    success: true,
  };
}
