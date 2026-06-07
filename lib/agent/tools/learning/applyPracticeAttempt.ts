import type { AgentToolContext, AgentToolDefinition, LearningSignal } from '@/lib/agent/types';
import { ApplyPracticeAttemptInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { computeMasteryUpdate } from '@/lib/atlas/masteryEngine';
import { createMemoryCardForSignal } from '@/lib/agent/tools/learning/createMemoryCard';
import { insertLearningSignal, recordAgentActivity, stableKey, upsertConcept } from '@/lib/agent/tools/learning/common';
import { updateOrCreateMicrotarget } from '@/lib/mission/microtargetEngine';
import { inferChapterForConcept, inferSubjectForConcept } from '@/lib/atlas/conceptResolver';

async function updatePracticeConceptMastery(
  context: AgentToolContext,
  input: { conceptId: string; signal: LearningSignal; evidenceRef: string }
) {
  const { data: concept, error: readError } = await context.supabase
    .from('concepts')
    .select('id, name, mastery, mastery_score')
    .eq('id', input.conceptId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!concept?.id) throw new Error('Concept missing during practice mastery update.');

  const update = computeMasteryUpdate({
    previousScore: Number(concept.mastery_score ?? 0),
    previousStatus: concept.mastery ?? null,
    signal: input.signal,
  });

  const existing = await context.supabase
    .from('mastery_events')
    .select('id')
    .eq('user_id', context.userId)
    .eq('concept_id', input.conceptId)
    .eq('source_id', input.evidenceRef)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (!existing.data?.id) {
    const { error: eventError } = await context.supabase.from('mastery_events').insert({
      user_id: context.userId,
      concept_id: input.conceptId,
      old_mastery: update.previousStatus,
      new_mastery: update.newStatus,
      source: 'practice',
      source_id: input.evidenceRef,
      evidence: input.signal.evidence ?? 'Practice attempt evidence',
      evidence_type: input.signal.correct ? 'practice_correct' : 'practice_wrong',
      weight: update.newScore - update.previousScore,
      confidence: input.signal.confidence,
    });
    if (eventError) throw eventError;
  }

  const { error: updateError } = await context.supabase
    .from('concepts')
    .update({
      mastery: update.newStatus,
      mastery_score: update.newScore,
      confidence: input.signal.confidence >= 0.8 ? 'high' : 'medium',
      last_reviewed_at: context.now.toISOString(),
      updated_at: context.now.toISOString(),
    })
    .eq('id', input.conceptId)
    .eq('user_id', context.userId);
  if (updateError) throw updateError;

  return update;
}

export const applyPracticeAttemptTool: AgentToolDefinition<typeof ApplyPracticeAttemptInputSchema, typeof ToolResultSchema> = {
  name: 'apply_practice_attempt',
  description: 'Apply saved practice attempts to ATLAS, MEMORY, microtargets, and learner activity.',
  inputSchema: ApplyPracticeAttemptInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 2,
  requiresAuth: true,
  async handler(input, context) {
    const items = input.items ?? [];
    const changedConceptIds = new Set<string>();
    const cardIds: string[] = [];
    let conceptsCreated = 0;
    let conceptsUpdated = 0;
    let eventsWritten = 0;
    let microtargetsUpdated = 0;

    for (const item of items.slice(0, 50)) {
      const conceptName = String(item.conceptName ?? item.topic ?? item.chapter ?? 'Practice Concept');
      const subject = typeof item.subject === 'string' ? item.subject : inferSubjectForConcept(conceptName);
      const chapter = typeof item.chapter === 'string' ? item.chapter : inferChapterForConcept(conceptName);
      const topic = typeof item.topic === 'string' ? item.topic : conceptName;
      const correct = item.isCorrect === true;
      const signal: LearningSignal = {
        type: correct ? 'concept_understood' : 'weak_area_detected',
        concept: conceptName,
        canonicalConcept: conceptName,
        subject,
        chapter,
        topic,
        confidence: correct ? 0.72 : 0.86,
        source: 'practice',
        correct,
        attemptId: typeof item.attemptId === 'string' ? item.attemptId : undefined,
        evidence: correct
          ? `Correct practice answer: ${String(item.question ?? conceptName).slice(0, 400)}`
          : `Wrong practice answer: ${String(item.question ?? conceptName).slice(0, 300)}. Selected: ${String(item.selectedAnswer ?? 'unknown')}; correct: ${String(item.correctAnswer ?? 'unknown')}.`,
        metadata: {
          practiceSetId: input.practiceSetId ?? null,
          practiceItemId: item.practiceItemId ?? null,
        },
      };

      const concept = await upsertConcept(context.supabase, {
        userId: context.userId,
        goalId: input.goalId ?? context.goalId ?? null,
        concept: conceptName,
        subject,
        chapter,
        topic,
      });
      if (concept.created) conceptsCreated += 1;
      changedConceptIds.add(concept.conceptId);

      const evidenceRef = stableKey([
        context.idempotencyKey,
        'practice',
        input.practiceSetId,
        typeof item.attemptId === 'string'
          ? item.attemptId
          : typeof item.practiceItemId === 'string'
            ? item.practiceItemId
            : concept.conceptId,
        correct ? 'correct' : 'wrong',
      ]);
      const mastery = await updatePracticeConceptMastery(context, {
        conceptId: concept.conceptId,
        signal,
        evidenceRef,
      });
      if (mastery.changed) conceptsUpdated += 1;

      await insertLearningSignal(context.supabase, context, {
        signal,
        sourceId: typeof item.attemptId === 'string' ? item.attemptId : null,
        idempotencyKey: `${evidenceRef}:signal`,
      });
      eventsWritten += 1;

      if (!correct) {
        const card = await createMemoryCardForSignal(context, {
          conceptId: concept.conceptId,
          signal,
          goalId: input.goalId ?? context.goalId ?? null,
        });
        if (card.cardId) cardIds.push(card.cardId);
      }

      const micro = await updateOrCreateMicrotarget(context.supabase, {
        userId: context.userId,
        goalId: input.goalId ?? context.goalId ?? null,
        eventType: 'practice_attempt_submitted',
        conceptId: concept.conceptId,
        concept: conceptName,
        subject,
        topic,
        now: context.now,
      });
      if (micro.changed) microtargetsUpdated += micro.ids.length || 1;
    }

    const actionId = await recordAgentActivity(context.supabase, {
      userId: context.userId,
      runId: context.runId,
      agentName: 'atlas',
      actionType: 'practice_attempt_submitted',
      targetType: 'practice_set',
      targetId: typeof input.practiceSetId === 'string' && /^[0-9a-f-]{36}$/i.test(input.practiceSetId) ? input.practiceSetId : null,
      confidence: 0.95,
      evidence: {
        practiceSetId: input.practiceSetId ?? null,
        metrics: input.metrics,
        conceptIds: Array.from(changedConceptIds),
        cardIds,
      },
      reason: `Practice attempt updated ${changedConceptIds.size} concept${changedConceptIds.size === 1 ? '' : 's'}.`,
      idempotencyKey: stableKey([context.idempotencyKey, 'practice-attempt', input.practiceSetId]),
    });

    return {
      success: true,
      changed: changedConceptIds.size > 0 || cardIds.length > 0,
      entityType: 'practice_attempt',
      entityIds: [actionId, ...Array.from(changedConceptIds), ...cardIds],
      summary: `Processed ${items.length} practice item${items.length === 1 ? '' : 's'} through the agent runtime.`,
      data: {
        conceptsCreated,
        conceptsUpdated,
        revisionCardsCreated: cardIds.length,
        microtargetsUpdated,
        eventsWritten,
        practiceAttemptsProcessed: items.length,
        agentActionId: actionId,
        conceptIds: Array.from(changedConceptIds),
        cardIds,
      },
    };
  },
};
