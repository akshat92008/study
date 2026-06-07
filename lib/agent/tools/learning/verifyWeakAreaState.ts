/**
 * verifyWeakAreaState tool - verify ATLAS concept and MEMORY card state.
 * Called after mutations to ensure state is as expected.
 */
import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema } from '@/lib/agent/tools/schemas';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const VerifyWeakAreaStateInputSchema = z.object({
  conceptId: z.string().uuid().optional(),
  conceptName: z.string().optional(),
  checkMemoryCards: z.boolean().default(true),
  goalId: z.string().uuid().nullable().optional(),
});

export type VerifyWeakAreaStateInput = z.infer<typeof VerifyWeakAreaStateInputSchema>;

export const verifyWeakAreaStateTool: AgentToolDefinition<typeof VerifyWeakAreaStateInputSchema, typeof ToolResultSchema> = {
  name: 'verify_weak_area_state',
  description: 'Verify ATLAS concept and MEMORY card state. Used after mutations to ensure writes persisted correctly.',
  inputSchema: VerifyWeakAreaStateInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 6,
  requiresAuth: true,
  async handler(input, context) {
    const warnings: string[] = [];

    // 1. Verify concept if provided
    let concept: any = null;
    if (input.conceptId || input.conceptName) {
      let query = context.supabase
        .from('concepts')
        .select('id, name, subject, chapter, topic, mastery, mastery_score, confidence, updated_at')
        .eq('user_id', context.userId);

      if (input.conceptId) query = query.eq('id', input.conceptId);
      else if (input.conceptName) query = query.ilike('name', `%${input.conceptName}%`);

      const { data, error } = await query.maybeSingle();
      if (error) warnings.push(`Concept verification error: ${error.message}`);
      concept = data ?? null;
    }

    // 2. Verify MEMORY cards for this concept if requested
    let memoryCards: any[] = [];
    if (input.checkMemoryCards && concept?.id) {
      const { data: cards, error: cardsError } = await context.supabase
        .from('revision_cards')
        .select('id, concept_id, front, due, state, stability, difficulty, created_at')
        .eq('user_id', context.userId)
        .eq('concept_id', concept.id)
        .limit(5);

      if (cardsError) warnings.push(`MEMORY card verification error: ${cardsError.message}`);
      else memoryCards = cards ?? [];
    }

    // 3. Verify if there's an active learning signal for this concept
    let recentSignals: any[] = [];
    if (concept?.id) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: signals, error: signalError } = await context.supabase
        .from('agent_learning_signals')
        .select('id, signal_type, concept_id, confidence, created_at')
        .eq('user_id', context.userId)
        .eq('concept_id', concept.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!signalError) recentSignals = signals ?? [];
    }

    const verified = Boolean(concept);
    const summary = verified
      ? `Concept '${concept?.name}' verified: mastery=${concept?.mastery}, ${memoryCards.length} MEMORY card(s), ${recentSignals.length} recent signal(s).`
      : 'Verification target not found.';

    return {
      success: true,
      changed: false,
      entityType: 'concept',
      entityIds: concept ? [concept.id] : [],
      summary,
      data: {
        concept,
        memoryCards,
        recentSignals,
        verified,
        warnings,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};