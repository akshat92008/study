import type { AgentToolDefinition, AgentToolContext, LearningSignal } from '@/lib/agent/types';
import { CreateMemoryCardInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { assertConceptOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { projectLearningSignal } from '@/lib/learner-state/projector';

export async function createMemoryCardForSignal(context: AgentToolContext, input: { conceptId: string; signal: LearningSignal; goalId?: string | null }) {
  const result = await projectLearningSignal(context.supabase, context.userId, {
    ...input.signal,
    metadata: {
      ...input.signal.metadata,
      conceptId: input.conceptId,
    }
  }, {
    goalId: input.goalId ?? context.goalId,
    context,
  });

  // Return structure matching old expectations if needed
  return { 
    success: result.success, 
    cardId: result.cardsCreated > 0 ? `card-${input.conceptId}` : null // placeholder if exact ID not available
  };
}

export const createMemoryCardTool: AgentToolDefinition<typeof CreateMemoryCardInputSchema, typeof ToolResultSchema> = {
  name: 'create_memory_card',
  description: 'Create durable revision cards for detected weak areas or misconceptions.',
  inputSchema: CreateMemoryCardInputSchema,
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
      }
    }, {
      goalId: context.goalId,
      context,
    });

    return {
      success: result.success,
      changed: result.cardsCreated > 0,
      entityType: 'revision_card',
      summary: result.cardsCreated > 0 
        ? `Revision card created for concept based on ${input.signal.type}.`
        : `Revision card already exists or not needed for this signal.`,
      data: result as any,
    };
  },
};
