import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, UpdateMicrotargetInputSchema } from '@/lib/agent/tools/schemas';
import { assertGoalOwned } from '@/lib/agent/guardrails/mutationGuardrails';
import { updateOrCreateMicrotarget } from '@/lib/mission/microtargetEngine';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';
import { isPlaceholderTitle } from '@/lib/topic-seeding/templates/neet/topic-skeleton';

export const updateMicrotargetTool: AgentToolDefinition<typeof UpdateMicrotargetInputSchema, typeof ToolResultSchema> = {
  name: 'update_microtarget',
  description: 'Persist daily mission microtarget progress from verified learning events.',
  inputSchema: UpdateMicrotargetInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 12,
  requiresAuth: true,
  async handler(input, context) {
    if ((input.topic && isPlaceholderTitle(input.topic)) || (input.concept && isPlaceholderTitle(input.concept))) {
      return {
        success: false,
        changed: false,
        entityType: 'daily_microtask',
        entityIds: [],
        summary: 'Ignored placeholder topic. Agents should not update or create placeholder topics.',
      };
    }

    const goalId = input.goalId ?? context.goalId ?? null;
    await assertGoalOwned(context.supabase, { userId: context.userId, goalId });
    const result = await updateOrCreateMicrotarget(context.supabase, {
      userId: context.userId,
      goalId,
      eventType: input.eventType,
      conceptId: input.conceptId ?? null,
      concept: input.concept ?? null,
      subject: input.subject ?? null,
      topic: input.topic ?? input.concept ?? null,
      now: context.now,
    });

    if (result.changed) {
      await recordAgentActivity(context.supabase, {
        userId: context.userId,
        runId: context.runId,
        agentName: 'command',
        actionType: 'mission_progress_updated',
        targetType: 'daily_microtask',
        targetId: result.ids[0] ?? null,
        confidence: 0.9,
        evidence: { eventType: input.eventType, concept: input.concept, goalId },
        reason: result.created ? 'COMMAND added a mission repair target.' : "COMMAND updated today's mission progress.",
        idempotencyKey: stableKey([context.idempotencyKey, 'microtarget', input.eventType, input.conceptId ?? input.concept]),
      });
    }

    return {
      success: true,
      changed: result.changed,
      entityType: 'daily_microtask',
      entityIds: result.ids,
      summary: result.changed ? 'Updated mission microtarget state.' : 'No matching microtarget needed an update.',
      data: result as any,
    };
  },
};
