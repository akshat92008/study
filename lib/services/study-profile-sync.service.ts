import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { runCognitionAgentTurn } from '@/lib/agent/runtime';

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
  }
) {
  const { userId, goalId, items, practiceSetId } = input;

  try {
    const runtime = await runCognitionAgentTurn({
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

    const total = input.metrics.correctCount + input.metrics.wrongCount;
    const scorePct = total > 0 ? Math.round((input.metrics.correctCount / total) * 100) : null;

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
    }).catch(() => undefined);

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
