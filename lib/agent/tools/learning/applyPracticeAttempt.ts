import type { AgentToolContext, AgentToolDefinition, LearningSignal } from '@/lib/agent/types';
import { ApplyPracticeAttemptInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';
import { updateOrCreateMicrotarget } from '@/lib/mission/microtargetEngine';
import { inferChapterForConcept, inferSubjectForConcept } from '@/lib/atlas/conceptResolver';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';

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
    let mistakesRecorded = 0;

    for (const item of items.slice(0, 50)) {
      const conceptName = String(item.conceptName ?? item.topic ?? item.chapter ?? '').trim();
      if (!conceptName) throw new Error('Practice item is missing a canonical concept.');
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

      const evidenceRef = stableKey([
        context.idempotencyKey,
        'practice',
        input.practiceSetId,
        typeof item.attemptId === 'string'
          ? item.attemptId
          : typeof item.practiceItemId === 'string'
            ? item.practiceItemId
            : conceptName,
        correct ? 'correct' : 'wrong',
      ]);
      const projection = await applyLearningEvent(context.supabase, {
        userId: context.userId,
        goalId: input.goalId ?? context.goalId ?? null,
        source: 'chat_practice',
        concept: {
          conceptId: typeof item.conceptId === 'string' ? item.conceptId : undefined,
          canonicalName: conceptName,
          subject: subject ?? undefined,
          chapter: chapter ?? undefined,
          topic,
        },
        result: {
          outcome: correct ? 'correct' : 'incorrect',
          confidence: signal.confidence,
          explanation: signal.evidence,
        },
        artifact: {
          practiceSetId: typeof input.practiceSetId === 'string' ? input.practiceSetId : undefined,
          practiceItemId: typeof item.practiceItemId === 'string' ? item.practiceItemId : undefined,
        },
        metadata: {
          attemptId: typeof item.attemptId === 'string' ? item.attemptId : null,
          questionText: item.question,
          userAnswer: item.selectedAnswer,
          correctAnswer: item.correctAnswer,
          idempotencyKey: evidenceRef,
        },
      }, { context });
      if (!projection.ok) {
        const error = new Error(projection.message) as Error & { code?: string };
        error.code = projection.code;
        throw error;
      }

      eventsWritten += 1;
      if (projection.conceptId) changedConceptIds.add(projection.conceptId);
      if (projection.masteryBefore !== projection.masteryAfter) conceptsUpdated += 1;
      cardIds.push(...projection.revisionCardIds);
      mistakesRecorded += projection.mistakeIds.length;

      const micro = await updateOrCreateMicrotarget(context.supabase, {
        userId: context.userId,
        goalId: input.goalId ?? context.goalId ?? null,
        eventType: 'practice_attempt_submitted',
        conceptId: projection.conceptId,
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
        mistakesRecorded,
        agentActionId: actionId,
        conceptIds: Array.from(changedConceptIds),
        cardIds,
      },
    };
  },
};
