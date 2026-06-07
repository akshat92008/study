import type { AgentToolDefinition } from '@/lib/agent/types';
import { RecordAutopsyMistakeInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { upsertMistakeRisk } from '@/lib/services/repair-loop.service';
import { upsertConcept } from '@/lib/agent/tools/learning/common';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';

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
    const concept = await upsertConcept(context.supabase, {
      userId: context.userId,
      goalId: input.goalId ?? context.goalId ?? null,
      concept: input.concept,
      subject: input.subject ?? null,
      chapter: input.chapter ?? null,
      topic: input.topic ?? input.concept,
    });
    const repair = await upsertMistakeRisk(context.supabase, {
      userId: context.userId,
      goalId: input.goalId ?? context.goalId ?? null,
      source: 'autopsy',
      subject: input.subject ?? null,
      chapter: input.chapter ?? input.topic ?? null,
      topic: input.topic ?? input.concept,
      concept: input.concept,
      conceptId: concept.conceptId,
      mistakeText: input.mistakeText,
      correctAnswer: input.correctAnswer ?? null,
      whyWrong: 'Recorded through the Cognition agent autopsy tool.',
      examTrap: 'Repair this mistake before similar practice.',
      category: 'conceptual_gap',
      sourceId: stableKey([context.idempotencyKey, 'autopsy', input.concept]),
      metadata: { runId: context.runId ?? null },
    });

    await recordAgentActivity(context.supabase, {
      userId: context.userId,
      runId: context.runId,
      agentName: 'autopsy',
      actionType: 'autopsy_mistake_recorded',
      targetType: 'mistake',
      targetId: repair.mistake?.id ?? null,
      confidence: 0.86,
      evidence: { input, conceptId: concept.conceptId, repair },
      reason: `AUTOPSY recorded a mistake for ${input.concept}.`,
      idempotencyKey: stableKey([context.idempotencyKey, 'autopsy-mistake', repair.mistake?.id ?? input.concept]),
    });

    return {
      success: true,
      changed: repair.created || repair.revisionCardCreated,
      entityType: 'mistake',
      entityIds: repair.mistake?.id ? [repair.mistake.id] : [],
      summary: `Recorded autopsy mistake for ${input.concept}.`,
      data: {
        mistakeId: repair.mistake?.id ?? null,
        conceptId: concept.conceptId,
        revisionCardCreated: repair.revisionCardCreated,
        retestScheduled: repair.retestScheduled,
      },
    };
  },
};
