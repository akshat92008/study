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
}

/**
 * Project Autopsy V3 results via the central projector.
 * Ensures consistent ATLAS, MEMORY, and event state.
 */
export async function projectAutopsyV3Results(input: ProjectAutopsyV3Input) {
  // We need a Supabase client. In the route, we already have one.
  // For simplicity here, we'll assume the caller might want to pass it, but for now we'll import it.
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { userId, assessmentId, reportId, report, diagnoses, goalId, subject } = input;

  logger.info('Projecting Autopsy V3 results via central projector', { userId, assessmentId, reportId });

  // 1. Project individual mistakes
  const results: ProjectionResult[] = [];
  for (const diagnosis of diagnoses) {
    const mistakeSignal: LearningSignal = {
      type: 'autopsy_mistake_detected',
      concept: diagnosis.topic,
      canonicalConcept: diagnosis.topic,
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
      },
    };

    const res = await projectLearningSignal(supabase, userId, mistakeSignal, { goalId });
    results.push(res);
  }

  // 2. Project overall assessment result signal
  const assessmentSignal: LearningSignal = {
    type: 'concept_practiced', // General progress signal
    confidence: 0.9,
    source: 'autopsy',
    evidence: `Completed Deep Autopsy assessment: ${report.summaryText}`,
    metadata: {
      assessmentId,
      reportId,
      score: report.overview?.score,
      totalMarks: report.overview?.totalMarks,
      goalId,
    },
  };

  await projectLearningSignal(supabase, userId, assessmentSignal, { goalId });

  return {
    mistakesProjected: results.length,
    success: true,
  };
}

