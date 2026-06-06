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

async function resolvePracticeConcept(
  supabase: any,
  input: {
    userId: string;
    goalId?: string | null;
    item: PracticeSyncItem;
  }
) {
  if (input.item.conceptId) return input.item.conceptId;

  const conceptName = input.item.conceptName ?? input.item.topic ?? input.item.chapter ?? null;
  if (!conceptName) return null;

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
  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('concepts')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      name: conceptName,
      subject: input.item.subject ?? null,
      chapter: input.item.chapter ?? input.item.topic ?? null,
      topic: input.item.topic ?? conceptName,
      mastery: input.item.isCorrect ? 'exposed' : 'developing',
      mastery_score: input.item.isCorrect ? 12 : 25,
    })
    .select('id')
    .single();

  return created?.id ?? null;
}

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

  for (const item of input.items.slice(0, 50)) {
    const conceptId = await resolvePracticeConcept(supabase, {
      userId: input.userId,
      goalId: input.goalId ?? null,
      item,
    });
    const conceptName = item.conceptName ?? item.topic ?? 'Practice mistake';

    if (conceptId) {
      conceptsTouched.add(conceptId);

      await recordMasteryEvidence({
        userId: input.userId,
        conceptId,
        evidenceType: item.isCorrect ? 'practice_correct' : 'practice_wrong',
        source: 'practice',
        sourceId: item.attemptId ?? item.practiceItemId ?? `${input.practiceSetId}:${conceptId}`,
        evidence: item.isCorrect
          ? `Correct practice answer on ${conceptName}.`
          : `Wrong practice answer on ${conceptName}.`,
        confidence: item.isCorrect ? 0.7 : 0.8,
        client: supabase,
      }).catch(() => undefined);

      if (!item.isCorrect) {
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
    }

    if (item.isCorrect) continue;

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

    if (existingMistake) {
      await supabase
        .from('mistakes')
        .update({ status: 'verified_mistake' })
        .eq('id', existingMistake.id)
        .eq('user_id', input.userId);
      continue;
    }

    const { error: mistakeError } = await supabase.from('mistakes').insert({
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      concept_id: conceptId,
      category: 'conceptual_gap',
      status: 'verified_mistake',
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
