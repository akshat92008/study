import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, UpdateConceptMasteryInputSchema } from '@/lib/agent/tools/schemas';
import { assertConceptOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';

export const updateConceptMasteryTool: AgentToolDefinition<typeof UpdateConceptMasteryInputSchema, typeof ToolResultSchema> = {
  name: 'update_concept_mastery',
  description: 'Apply cautious evidence-based mastery updates and record evidence.',
  inputSchema: UpdateConceptMasteryInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 20,
  requiresAuth: true,
  async handler(input, context) {
    await assertConceptOwned(context.supabase, { userId: context.userId, conceptId: input.conceptId });
    
    const outcome = input.signal.correct === true || input.signal.type === 'concept_understood'
      ? 'correct'
      : input.signal.type === 'revision_reviewed'
        ? 'reviewed'
        : input.signal.type === 'explanation_generated'
          ? 'partial'
          : 'incorrect';
    const result = await applyLearningEvent(context.supabase, {
      userId: context.userId,
      goalId: context.goalId ?? null,
      source: input.signal.type === 'revision_reviewed' ? 'revision' : 'chat_practice',
      concept: {
        conceptId: input.conceptId,
        canonicalName: input.signal.canonicalConcept ?? input.signal.concept,
        subject: input.signal.subject ?? undefined,
        chapter: input.signal.chapter ?? undefined,
        topic: input.signal.topic ?? undefined,
      },
      result: {
        outcome,
        confidence: input.signal.confidence,
        explanation: input.signal.evidence,
      },
      metadata: {
        ...input.signal.metadata,
        idempotencyKey: input.evidenceRef ?? `${context.idempotencyKey}:mastery:${input.conceptId}`,
      },
    }, { context });

    return {
      success: result.ok,
      changed: result.ok && result.masteryBefore !== result.masteryAfter,
      entityType: 'concept',
      entityIds: result.ok ? [input.conceptId, ...result.revisionCardIds, ...result.mistakeIds] : [input.conceptId],
      summary: result.ok && result.masteryBefore !== result.masteryAfter
        ? `Mastery updated for concept based on ${input.signal.type}.`
        : result.ok ? 'Mastery evidence recorded for concept.' : result.message,
      data: result as any,
      ...(!result.ok ? { error: { code: result.code, message: result.message } } : {}),
    };
  },
};
