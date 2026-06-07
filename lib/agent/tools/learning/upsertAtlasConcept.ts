import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, UpsertAtlasConceptInputSchema } from '@/lib/agent/tools/schemas';
import { assertGoalOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { recordAgentActivity, stableKey, upsertConcept } from '@/lib/agent/tools/learning/common';

export const upsertAtlasConceptTool: AgentToolDefinition<typeof UpsertAtlasConceptInputSchema, typeof ToolResultSchema> = {
  name: 'upsert_atlas_concept',
  description: 'Create or update a canonical ATLAS concept for the learner.',
  inputSchema: UpsertAtlasConceptInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 12,
  requiresAuth: true,
  async handler(input, context) {
    const goalId = input.goalId ?? context.goalId ?? null;
    await assertGoalOwned(context.supabase, { userId: context.userId, goalId });
    const result = await upsertConcept(context.supabase, {
      userId: context.userId,
      goalId,
      concept: input.concept,
      subject: input.subject ?? null,
      chapter: input.chapter ?? null,
      topic: input.topic ?? input.concept,
    });

    await recordAgentActivity(context.supabase, {
      userId: context.userId,
      runId: context.runId,
      agentName: 'atlas',
      actionType: result.created ? 'atlas_concept_created' : 'atlas_concept_resolved',
      targetType: 'concept',
      targetId: result.conceptId,
      confidence: 0.9,
      evidence: { concept: input.concept, canonical: result.concept?.name, goalId },
      reason: result.created ? `ATLAS started tracking ${result.concept?.name}.` : `ATLAS resolved ${result.concept?.name}.`,
      idempotencyKey: stableKey([context.idempotencyKey, 'atlas', result.conceptId, result.created ? 'created' : 'resolved']),
    });

    return {
      success: true,
      changed: result.created,
      entityType: 'concept',
      entityIds: [result.conceptId],
      summary: result.created ? `Created ATLAS concept ${result.concept?.name}.` : `Resolved ATLAS concept ${result.concept?.name}.`,
      data: result as any,
    };
  },
};

