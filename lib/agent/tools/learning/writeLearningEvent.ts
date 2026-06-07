import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, WriteLearningEventInputSchema } from '@/lib/agent/tools/schemas';
import { assertGoalOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { insertLearningSignal, recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';

function agentForEvent(eventType: string): 'mind' | 'rag' | 'atlas' | 'memory' | 'planner' | 'command' | 'autopsy' {
  if (eventType === 'source_used') return 'rag';
  if (eventType.includes('mastery') || eventType.includes('weak') || eventType.includes('misconception')) return 'atlas';
  if (eventType.includes('memory') || eventType.includes('revision_card')) return 'memory';
  if (eventType.includes('mission') || eventType.includes('microtarget')) return 'command';
  if (eventType.includes('plan') || eventType.includes('session')) return 'planner';
  if (eventType.includes('autopsy') || eventType.includes('mistake')) return 'autopsy';
  return 'mind';
}

export const writeLearningEventTool: AgentToolDefinition<typeof WriteLearningEventInputSchema, typeof ToolResultSchema> = {
  name: 'write_learning_event',
  description: 'Write real learner-facing activity to learner_events and agent_actions.',
  inputSchema: WriteLearningEventInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 20,
  requiresAuth: true,
  async handler(input, context) {
    const goalId = input.goalId ?? context.goalId ?? null;
    await assertGoalOwned(context.supabase, { userId: context.userId, goalId });
    const idempotencyKey = input.idempotencyKey ?? stableKey([context.idempotencyKey, 'learning-event', input.eventType, JSON.stringify(input.payload).slice(0, 80)]);

    const { data: existingAction, error: existingActionError } = await context.supabase
      .from('agent_actions')
      .select('id')
      .eq('user_id', context.userId)
      .eq('action_type', input.eventType)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existingActionError) throw existingActionError;
    if (existingAction?.id) {
      return {
        success: true,
        changed: false,
        entityType: 'learning_event',
        entityIds: [existingAction.id],
        summary: `Learning event ${input.eventType} was already recorded.`,
        data: { agentActionId: existingAction.id, idempotencyKey, duplicate: true },
      };
    }

    const { data: learnerEvent, error: learnerEventError } = await context.supabase
      .from('learner_events')
      .insert({
        user_id: context.userId,
        event_type: input.eventType,
        event_data: {
          ...input.payload,
          goalId,
          runId: context.runId ?? null,
          idempotencyKey,
        },
      })
      .select('id')
      .single();
    if (learnerEventError) throw learnerEventError;

    const agentActionId = await recordAgentActivity(context.supabase, {
      userId: context.userId,
      runId: context.runId,
      agentName: agentForEvent(input.eventType),
      actionType: input.eventType,
      targetType: typeof input.payload.targetType === 'string' ? input.payload.targetType : null,
      targetId: typeof input.payload.targetId === 'string' ? input.payload.targetId : null,
      confidence: typeof input.payload.confidence === 'number' ? input.payload.confidence : 0.8,
      evidence: input.payload,
      reason: typeof input.payload.reason === 'string' ? input.payload.reason : input.eventType.replace(/_/g, ' '),
      idempotencyKey,
    });

    if (input.eventType === 'source_used' && typeof input.payload.materialId === 'string') {
      await insertLearningSignal(context.supabase, context, {
        signal: {
          type: 'source_used',
          materialId: input.payload.materialId,
          materialTitle: typeof input.payload.materialTitle === 'string' ? input.payload.materialTitle : undefined,
          chunkIds: Array.isArray(input.payload.chunkIds) ? input.payload.chunkIds.filter((id): id is string => typeof id === 'string') : [],
          confidence: 0.95,
          source: 'source',
          evidence: 'Source chunks retrieved and used.',
        },
        idempotencyKey: `${idempotencyKey}:signal`,
      });
    }

    return {
      success: true,
      changed: true,
      entityType: 'learning_event',
      entityIds: [learnerEvent.id, agentActionId],
      summary: `Wrote learner event ${input.eventType}.`,
      data: { learnerEventId: learnerEvent.id, agentActionId, idempotencyKey },
    };
  },
};
