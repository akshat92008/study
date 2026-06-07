import type { AgentToolDefinition } from '@/lib/agent/types';
import { AdaptDailyPlanInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';

export const adaptDailyPlanTool: AgentToolDefinition<typeof AdaptDailyPlanInputSchema, typeof ToolResultSchema> = {
  name: 'adapt_daily_plan',
  description: 'Adapt today/tomorrow daily microtasks based on weak areas and recent evidence.',
  inputSchema: AdaptDailyPlanInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 2,
  requiresAuth: true,
  async handler(input, context) {
    const weakConcepts = input.weakConcepts.slice(0, 3);
    if (!weakConcepts.length) {
      return {
        success: true,
        changed: false,
        entityType: 'daily_microtask',
        entityIds: [],
        summary: 'No weak concepts available for plan adaptation.',
        data: { created: 0 },
      };
    }

    const tomorrow = new Date(context.now.getTime() + 86_400_000).toISOString().slice(0, 10);
    const rows = weakConcepts.map((concept, index) => ({
      user_id: context.userId,
      goal_id: input.goalId ?? context.goalId ?? null,
      task_date: tomorrow,
      title: `Repair ${concept}`,
      topic: concept,
      type: index === 0 ? 'practice' : 'revision',
      estimated_minutes: index === 0 ? 20 : 12,
      status: 'pending',
      priority: index === 0 ? 'high' : 'medium',
      source: 'planner',
    }));

    const existing = await context.supabase
      .from('daily_microtasks')
      .select('id, title')
      .eq('user_id', context.userId)
      .eq('task_date', tomorrow)
      .in('title', rows.map((row) => row.title));
    if (existing.error) throw existing.error;

    const existingTitles = new Set((existing.data ?? []).map((row: any) => row.title));
    const rowsToInsert = rows.filter((row) => !existingTitles.has(row.title));
    const insertedIds: string[] = [];
    if (rowsToInsert.length > 0) {
      const { data, error } = await context.supabase
        .from('daily_microtasks')
        .insert(rowsToInsert)
        .select('id');
      if (error) throw error;
      insertedIds.push(...(data ?? []).map((row: any) => row.id));
    }

    if (insertedIds.length > 0) {
      await recordAgentActivity(context.supabase, {
        userId: context.userId,
        runId: context.runId,
        agentName: 'planner',
        actionType: 'daily_plan_adapted',
        targetType: 'daily_microtask',
        targetId: insertedIds[0] ?? null,
        confidence: 0.76,
        evidence: { reason: input.reason, weakConcepts, insertedIds },
        reason: "PLANNER adapted tomorrow's session around weak areas.",
        idempotencyKey: stableKey([context.idempotencyKey, 'plan-adapted', tomorrow, weakConcepts.join('|')]),
      });
    }

    return {
      success: true,
      changed: insertedIds.length > 0,
      entityType: 'daily_microtask',
      entityIds: insertedIds,
      summary: insertedIds.length > 0 ? `Adapted daily plan with ${insertedIds.length} microtarget${insertedIds.length === 1 ? '' : 's'}.` : 'Daily plan already had matching adaptations.',
      data: { insertedIds, skippedExisting: rows.length - insertedIds.length },
    };
  },
};
