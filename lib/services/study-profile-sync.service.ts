import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { runHermesTurn } from '@/lib/agent/runtime';
import type { CognitionAgentTurnOutput } from '@/lib/agent/types';

type PracticeSyncItem = {
  attemptId?: string | null;
  practiceItemId?: string | null;
  question?: string | null;
  conceptId?: string | null;
  conceptName?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  isCorrect: boolean;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
};

export async function syncStudyProfileAfterPracticeAttempt(
  supabase: SupabaseClient,
  input: {
    userId: string;
    goalId?: string | null;
    practiceSetId: string;
    metrics: {
      correctCount: number;
      wrongCount: number;
      wrongConceptIds?: string[];
      wrongConceptNames?: string[];
    };
    items: PracticeSyncItem[];
    runtimeOutput?: CognitionAgentTurnOutput; // Added to avoid duplicate runtime calls
  }
) {
  const { userId, goalId, items, practiceSetId } = input;

  try {
    // Fix 11: Use provided runtime output or call runtime exactly once if missing
    let runtime = input.runtimeOutput;

    if (!runtime) {
      runtime = await runHermesTurn({
        userId,
        channel: 'practice',
        goalId: goalId ?? undefined,
        payload: {
          practiceSetId,
          metrics: input.metrics,
          items,
        },
      }, {
        supabase,
        idempotencyKey: `practice-agent:${userId}:${practiceSetId}:${items.map((item) => item.attemptId ?? item.practiceItemId ?? '').join('|')}`,
      });
    }

    const { correctCount, wrongCount } = input.metrics;
    const total = correctCount + wrongCount;
    const scorePct = total > 0 ? Math.round((correctCount / total) * 100) : null;


    if (goalId && scorePct !== null) {
      await supabase
        .from('learning_goals')
        .update({
          progress: scorePct,
          last_active_at: new Date().toISOString(),
        })
        .eq('id', goalId)
        .eq('user_id', userId);
    }

    await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
      client: supabase,
      goalId: goalId ?? null,
    });

    return {
      success: runtime.verification.ok,
      mutationSummary: runtime.mutationSummary,
      trajectoryId: runtime.trajectoryId,
      verification: runtime.verification,
      progressScore: scorePct,
      sessionCardInvalidated: true,
      wrongItems: input.metrics.wrongCount,
      conceptsTouched: runtime.mutationSummary.conceptsCreated + runtime.mutationSummary.conceptsUpdated,
      mistakesCreated: runtime.mutationSummary.conceptsUpdated,
      repairCardsCreated: runtime.mutationSummary.revisionCardsCreated,
      retestsScheduled: runtime.mutationSummary.revisionCardsCreated,
      cardsCreated: runtime.mutationSummary.revisionCardsCreated,
      tasksCreated: runtime.mutationSummary.microtargetsUpdated,
      notificationSent: runtime.mutationSummary.changed,
    };
  } catch (error) {
    logger.error('syncStudyProfileAfterPracticeAttempt failed', error, {
      userId,
      practiceSetId,
    });
    throw error;
  }
}
