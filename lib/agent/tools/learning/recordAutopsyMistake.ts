import type { AgentToolDefinition } from '@/lib/agent/types';
import { RecordAutopsyMistakeInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { stableKey } from '@/lib/agent/tools/learning/common';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';

export const recordAutopsyMistakeTool: AgentToolDefinition<typeof RecordAutopsyMistakeInputSchema, typeof ToolResultSchema> = {
  name: 'record_autopsy_mistake',
  description: 'Record an autopsy mistake, map it to ATLAS, create MEMORY repair, and verify persisted state.',
  inputSchema: RecordAutopsyMistakeInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 6,
  requiresAuth: true,
  async handler(input, context) {
    const projection = await applyLearningEvent(context.supabase, {
      userId: context.userId,
      goalId: input.goalId ?? context.goalId ?? null,
      source: 'autopsy',
      concept: {
        canonicalName: input.concept,
        subject: input.subject ?? undefined,
        chapter: input.chapter ?? undefined,
        topic: input.topic ?? input.concept,
      },
      result: {
        outcome: 'incorrect',
        confidence: 0.86,
        mistakeType: 'conceptual_gap',
        explanation: input.mistakeText,
      },
      metadata: {
        mistakeText: input.mistakeText,
        correctAnswer: input.correctAnswer ?? null,
        whyWrong: 'Recorded through the Amaura autopsy tool.',
        idempotencyKey: stableKey([context.idempotencyKey, 'autopsy', input.concept]),
      },
    }, { context });

    if (!projection.ok) {
      return {
        success: false,
        changed: false,
        entityType: 'mistake',
        entityIds: [],
        summary: projection.message,
        error: { code: projection.code, message: projection.message },
        data: { traceId: projection.traceId },
      };
    }

    return {
      success: true,
      changed: true,
      entityType: 'mistake',
      entityIds: projection.mistakeIds,
      summary: `Recorded autopsy mistake for ${input.concept}.`,
      data: {
        mistakeId: projection.mistakeIds[0] ?? null,
        conceptId: projection.conceptId,
        revisionCardCreated: projection.revisionCardIds.length > 0,
        retestScheduled: projection.mistakeIds.length > 0,
        mistakesRecorded: projection.mistakeIds.length,
        revisionCardsCreated: projection.revisionCardIds.length,
      },
    };
  },
};
