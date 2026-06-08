import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, UpdateConceptMasteryInputSchema } from '@/lib/agent/tools/schemas';
import { assertConceptOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { projectLearningSignal } from '@/lib/learner-state/projector';

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
    
    // Fix: Unify mutation path via central projector
    const result = await projectLearningSignal(context.supabase, context.userId, {
      ...input.signal,
      metadata: {
        ...input.signal.metadata,
        conceptId: input.conceptId,
        idempotencyKey: input.evidenceRef,
      }
    }, {
      goalId: context.goalId,
      context,
    });

    return {
      success: result.success,
      changed: result.masteryUpdated,
      entityType: 'concept',
      entityIds: [input.conceptId],
      summary: result.masteryUpdated 
        ? `Mastery updated for concept based on ${input.signal.type}.`
        : `Mastery evidence recorded for concept.`,
      data: result as any,
    };
  },
};

