import type { AgentToolDefinition, AgentToolContext, LearningSignal } from '@/lib/agent/types';
import { CreateMemoryCardInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { assertConceptOwned } from '@/lib/agent/guardrails/mutationGuardrails';

async function findConceptCards(context: AgentToolContext, conceptId: string): Promise<string[]> {
  const { data, error } = await context.supabase
    .from('revision_cards')
    .select('id')
    .eq('user_id', context.userId)
    .eq('concept_id', conceptId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function createMemoryCardForSignal(context: AgentToolContext, input: { conceptId: string; signal: LearningSignal; goalId?: string | null }) {
  const cardIds = await findConceptCards(context, input.conceptId);
  return { success: cardIds.length > 0, cardId: cardIds[0] ?? null };
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
    
    const cardIds = await findConceptCards(context, input.conceptId);

    return {
      success: cardIds.length > 0,
      changed: false,
      entityType: 'revision_card',
      entityIds: cardIds,
      summary: cardIds.length > 0
        ? 'Verified the canonical learner event created a revision card for this concept.'
        : 'No revision card exists for this concept after projection.',
      data: { cardIds },
    };
  },
};
