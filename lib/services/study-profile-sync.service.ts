import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { notifyWeakConceptPlanChange, type WeakConceptPlanChange } from '@/lib/services/learning-plan-updates.service';

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
  supabase: any,
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
  const wrongItems = input.items.filter((item) => item.isCorrect === false);
  const conceptsTouched = new Set<string>();
  const weakConcepts: WeakConceptPlanChange[] = [];
  let mistakesCreated = 0;

  for (const item of wrongItems.slice(0, 25)) {
    let conceptId = item.conceptId ?? null;
    const conceptName = item.conceptName ?? item.topic ?? 'Practice mistake';

    if (!conceptId && conceptName) {
      let conceptQuery = supabase
        .from('concepts')
        .select('id')
        .eq('user_id', input.userId)
        .eq('name', conceptName);
      conceptQuery = input.goalId
        ? conceptQuery.eq('goal_id', input.goalId)
        : typeof conceptQuery.is === 'function'
          ? conceptQuery.is('goal_id', null)
          : conceptQuery;
      const { data: existing } = await conceptQuery.maybeSingle();

      if (existing?.id) {
        conceptId = existing.id;
      } else {
        const { data: created } = await supabase
          .from('concepts')
          .insert({
            user_id: input.userId,
            goal_id: input.goalId ?? null,
            name: conceptName,
            subject: item.subject ?? null,
            chapter: item.chapter ?? item.topic ?? null,
            topic: item.topic ?? conceptName,
            mastery: 'developing',
            mastery_score: 0.25,
          })
          .select('id')
          .single();
        conceptId = created?.id ?? null;
      }
    }

    if (conceptId) {
      conceptsTouched.add(conceptId);
      await supabase
        .from('concepts')
        .update({
          mastery: 'developing',
          mastery_score: 0.25,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conceptId)
        .eq('user_id', input.userId);

      await recordMasteryEvidence({
        userId: input.userId,
        conceptId,
        evidenceType: 'practice_wrong',
        source: 'practice',
        sourceId: item.attemptId ?? item.practiceItemId ?? `${input.practiceSetId}:${conceptId}`,
        evidence: `Wrong practice answer on ${conceptName}.`,
        confidence: 0.8,
        client: supabase,
      }).catch(() => undefined);

      weakConcepts.push({
        conceptId,
        conceptName,
        subject: item.subject ?? null,
        chapter: item.chapter ?? item.topic ?? null,
        topic: item.topic ?? conceptName,
        reason: 'wrong practice answer',
        sourceId: item.attemptId ?? item.practiceItemId ?? input.practiceSetId,
      });
    }

    let mistakeQuery = supabase
      .from('mistakes')
      .select('id')
      .eq('user_id', input.userId)
      .eq('question_text', item.question ?? '');
    mistakeQuery = input.goalId
      ? mistakeQuery.eq('goal_id', input.goalId)
      : typeof mistakeQuery.is === 'function'
        ? mistakeQuery.is('goal_id', null)
        : mistakeQuery;
    const { data: existingMistake } = await mistakeQuery.maybeSingle();

    if (existingMistake) continue;

    const { error: mistakeError } = await supabase.from('mistakes').insert({
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      concept_id: conceptId,
      category: 'conceptual_gap',
      status: 'pending_review',
      subject: item.subject ?? null,
      chapter: item.chapter ?? item.topic ?? null,
      topic: item.topic ?? conceptName,
      question_text: item.question ?? null,
      user_answer: item.selectedAnswer ?? null,
      correct_answer: item.correctAnswer ?? null,
      marks_lost: 1,
      total_marks: 1,
      ai_analysis: null,
      improvement_suggestion: 'Review this concept and retry a similar question.',
      extraction_confidence: 1,
    });

    if (!mistakeError) mistakesCreated += 1;
  }

  const total = input.metrics.correctCount + input.metrics.wrongCount;
  const scorePct = total > 0 ? Math.round((input.metrics.correctCount / total) * 100) : null;
  if (input.goalId && scorePct !== null) {
    const { data: goal } = await supabase
      .from('learning_goals')
      .select('progress')
      .eq('id', input.goalId)
      .eq('user_id', input.userId)
      .maybeSingle();
    const current = Number(goal?.progress ?? 0);
    await supabase
      .from('learning_goals')
      .update({
        progress: Math.max(current, Math.min(100, scorePct)),
        last_active_at: new Date().toISOString(),
      })
      .eq('id', input.goalId)
      .eq('user_id', input.userId);
  }

  await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: input.goalId ?? null,
  }).catch(() => undefined);

  const planUpdate = await notifyWeakConceptPlanChange({
    userId: input.userId,
    goalId: input.goalId ?? null,
    weakConcepts,
    sourceType: 'practice_attempt',
    sourceEventId: input.practiceSetId,
    client: supabase,
  }).catch(() => ({
    cardsCreated: 0,
    tasksCreated: 0,
    notified: false,
  }));

  return {
    wrongItems: wrongItems.length,
    conceptsTouched: conceptsTouched.size,
    mistakesCreated,
    cardsCreated: planUpdate.cardsCreated,
    tasksCreated: planUpdate.tasksCreated,
    notificationSent: planUpdate.notified,
    progressScore: scorePct,
    sessionCardInvalidated: true,
  };
}
