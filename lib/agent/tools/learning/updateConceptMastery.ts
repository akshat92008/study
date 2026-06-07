import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, UpdateConceptMasteryInputSchema } from '@/lib/agent/tools/schemas';
import { assertConceptOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { computeMasteryUpdate } from '@/lib/atlas/masteryEngine';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';

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
    const { data: concept, error: readError } = await context.supabase
      .from('concepts')
      .select('id, name, mastery, mastery_score')
      .eq('id', input.conceptId)
      .eq('user_id', context.userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!concept?.id) throw new Error('Concept not found for mastery update.');

    const update = computeMasteryUpdate({
      previousScore: Number(concept.mastery_score ?? 0),
      previousStatus: concept.mastery ?? null,
      signal: input.signal,
    });
    const evidenceRef = input.evidenceRef ?? stableKey([context.idempotencyKey, 'mastery', input.conceptId, input.signal.type, input.signal.evidence]);
    const existing = await context.supabase
      .from('mastery_events')
      .select('id')
      .eq('user_id', context.userId)
      .eq('concept_id', input.conceptId)
      .eq('source_id', evidenceRef)
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (!existing.data?.id) {
      const { error: eventError } = await context.supabase.from('mastery_events').insert({
        user_id: context.userId,
        concept_id: input.conceptId,
        old_mastery: update.previousStatus,
        new_mastery: update.newStatus,
        source: context.channel,
        source_id: evidenceRef,
        evidence: input.signal.evidence ?? input.signal.type,
        evidence_type: input.signal.type,
        weight: update.newScore - update.previousScore,
        confidence: input.signal.confidence,
      });
      if (eventError) throw eventError;
    }

    const { error: updateError } = await context.supabase
      .from('concepts')
      .update({
        mastery: update.newStatus,
        mastery_score: update.newScore,
        confidence: input.signal.confidence >= 0.8 ? 'high' : input.signal.confidence >= 0.55 ? 'medium' : 'low',
        last_reviewed_at: context.now.toISOString(),
        updated_at: context.now.toISOString(),
      })
      .eq('id', input.conceptId)
      .eq('user_id', context.userId);
    if (updateError) throw updateError;

    await recordAgentActivity(context.supabase, {
      userId: context.userId,
      runId: context.runId,
      agentName: 'atlas',
      actionType: 'atlas_mastery_updated',
      targetType: 'concept',
      targetId: input.conceptId,
      confidence: input.signal.confidence,
      beforeState: { mastery: update.previousStatus, score: update.previousScore },
      afterState: { mastery: update.newStatus, score: update.newScore },
      evidence: { signal: input.signal, evidenceRef },
      reason: `${concept.name} moved to ${update.newStatus}.`,
      idempotencyKey: stableKey([context.idempotencyKey, 'atlas-mastery', input.conceptId, evidenceRef]),
    });

    return {
      success: true,
      changed: update.changed,
      entityType: 'concept',
      entityIds: [input.conceptId],
      summary: `Updated mastery for ${concept.name}: ${update.previousStatus} -> ${update.newStatus}.`,
      data: { conceptId: input.conceptId, ...update },
    };
  },
};

