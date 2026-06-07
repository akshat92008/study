import type { AgentToolContext, AgentToolDefinition, LearningSignal } from '@/lib/agent/types';
import { CreateMemoryCardInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { assertConceptOwned, assertMaterialOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { findRecentMemoryCard } from '@/lib/agent/guardrails/duplicateMemoryGuard';
import { generateMemoryCard } from '@/lib/memory/cardGenerator';
import { firstDueAt } from '@/lib/memory/scheduler';
import { memoryCardKey } from '@/lib/memory/dedupe';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';

export async function createMemoryCardForSignal(
  context: AgentToolContext,
  input: {
    conceptId: string;
    signal: LearningSignal;
    sourceMaterialId?: string | null;
    goalId?: string | null;
  }
) {
  await assertConceptOwned(context.supabase, { userId: context.userId, conceptId: input.conceptId });
  if (input.sourceMaterialId) {
    await assertMaterialOwned(context.supabase, { userId: context.userId, materialId: input.sourceMaterialId });
  }

  if (!['weak_area_detected', 'misconception_detected', 'revision_needed', 'practice_needed', 'session_completed'].includes(input.signal.type)) {
    return { created: false, cardId: null, skipped: true, reason: 'Signal does not require a durable revision card.' };
  }

  const { data: concept, error: conceptError } = await context.supabase
    .from('concepts')
    .select('id, name, subject, chapter, topic')
    .eq('id', input.conceptId)
    .eq('user_id', context.userId)
    .maybeSingle();
  if (conceptError) throw conceptError;
  if (!concept?.id) throw new Error('Concept not found for memory card.');

  const normalizedKey = memoryCardKey({
    userId: context.userId,
    conceptId: input.conceptId,
    source: input.signal.type,
  });

  const anyExisting = await context.supabase
    .from('revision_cards')
    .select('id')
    .eq('user_id', context.userId)
    .eq('normalized_key', normalizedKey)
    .maybeSingle();
  if (anyExisting.error) throw anyExisting.error;
  if (anyExisting.data?.id) return { created: false, cardId: anyExisting.data.id as string, skipped: false, reason: 'Existing MEMORY card reused.' };

  const since = new Date(context.now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const recentCardId = await findRecentMemoryCard(context.supabase, {
    userId: context.userId,
    normalizedKey,
    sinceIso: since,
  });
  if (recentCardId) return { created: false, cardId: recentCardId, skipped: false, reason: 'Recent duplicate MEMORY card reused.' };

  const generated = generateMemoryCard(input.signal);
  const { data, error } = await context.supabase
    .from('revision_cards')
    .insert({
      user_id: context.userId,
      goal_id: input.goalId ?? context.goalId ?? null,
      concept_id: input.conceptId,
      front: generated.front,
      back: generated.back,
      subject: input.signal.subject ?? concept.subject ?? 'General',
      chapter: input.signal.chapter ?? concept.chapter ?? concept.topic ?? concept.name ?? 'General',
      due: firstDueAt(context.now),
      state: 0,
      stability: 0,
      difficulty: input.signal.type === 'misconception_detected' ? 7 : 5,
      source_type: input.sourceMaterialId ? 'study_material' : input.signal.source ?? context.channel,
      source_id: input.sourceMaterialId ?? input.signal.attemptId ?? input.conceptId,
      source_hash: normalizedKey,
      normalized_key: normalizedKey,
      verified: true,
      confidence: input.signal.confidence,
      metadata: {
        signal: input.signal,
        runId: context.runId ?? null,
        sourceMaterialId: input.sourceMaterialId ?? null,
      },
    })
    .select('id')
    .single();
  if (error) throw error;

  const cardId = data.id as string;
  await recordAgentActivity(context.supabase, {
    userId: context.userId,
    runId: context.runId,
    agentName: 'memory',
    actionType: 'memory_card_created',
    targetType: 'revision_card',
    targetId: cardId,
    confidence: input.signal.confidence,
    evidence: { signal: input.signal, conceptId: input.conceptId },
    reason: `MEMORY created a review card for ${concept.name}.`,
    idempotencyKey: stableKey([context.idempotencyKey, 'memory-card', cardId]),
  });

  return { created: true, cardId, skipped: false, reason: 'MEMORY card created.' };
}

export const createMemoryCardTool: AgentToolDefinition<typeof CreateMemoryCardInputSchema, typeof ToolResultSchema> = {
  name: 'create_memory_card',
  description: 'Create a durable MEMORY revision card in the table used by Review, deduped within 24 hours.',
  inputSchema: CreateMemoryCardInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 12,
  requiresAuth: true,
  async handler(input, context) {
    const result = await createMemoryCardForSignal(context, {
      conceptId: input.conceptId,
      signal: input.signal,
      sourceMaterialId: input.sourceMaterialId ?? null,
      goalId: input.goalId ?? context.goalId ?? null,
    });
    return {
      success: true,
      changed: result.created,
      entityType: 'revision_card',
      entityIds: result.cardId ? [result.cardId] : [],
      summary: result.reason,
      data: result as any,
    };
  },
};
