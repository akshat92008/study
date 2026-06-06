import { z } from 'zod';
import { AMAURA_EVENTS } from '@/lib/amaura/events/event-matrix';
import { listActiveGoals } from '@/lib/amaura/goals/goal-repository';
import { createNotificationIfNotExists } from '@/lib/amaura/notifications/notification-repository';
import { serviceUpsertNextAction } from '@/lib/amaura/session/session-card-repository';
import {
  listOverdueTasks,
  listPendingTasksForGoal,
  listTodayTasks,
} from '@/lib/amaura/tasks/task-repository';
import { eventDedupKey } from '../idempotency';
import {
  AmauraAgentResultSchema,
  emptyAmauraResult,
  skippedAmauraResult,
  type AmauraAgentDefinition,
} from '../types';

const NextActionPayloadSchema = z.object({
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
}).passthrough();

type NextActionPayload = z.infer<typeof NextActionPayloadSchema>;

export const NextActionAgent: AmauraAgentDefinition<NextActionPayload> = {
  name: 'NextActionAgent',
  handledEvents: [
    AMAURA_EVENTS.AMAURA_GOAL_CREATED,
    AMAURA_EVENTS.AMAURA_TASK_CREATED,
    AMAURA_EVENTS.AMAURA_TASK_COMPLETED,
    AMAURA_EVENTS.AMAURA_TASK_SKIPPED,
    AMAURA_EVENTS.AMAURA_PLAN_ADAPTED,
    AMAURA_EVENTS.AMAURA_GOAL_PROGRESS_EVALUATED,
    AMAURA_EVENTS.AUTOPSY_V3_REPORT_READY,
    AMAURA_EVENTS.MEMORY_REVIEW_COMPLETED,
    AMAURA_EVENTS.ATLAS_CONCEPT_UPDATED,
    AMAURA_EVENTS.SESSION_CLOSED,
    AMAURA_EVENTS.DAILY_AGENT_TICK,
  ],
  stateVisibleEffects: ['session_card', 'notification'],
  inputSchema: NextActionPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('NextActionAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'event' },
  notification: { priority: 'low', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = payload.goalId ?? payload.goal_id ?? context.goalId;
    const goals = goalId
      ? (await listActiveGoals(context.userId)).filter((goal: any) => goal.id === goalId)
      : await listActiveGoals(context.userId);
    if (goals.length === 0) return skippedAmauraResult('No active goals for next action.');

    const candidates: any[] = [];
    const overdue = await listOverdueTasks(context.userId);
    const todayTasks = await listTodayTasks(context.userId);
    candidates.push(...overdue, ...todayTasks);

    for (const goal of goals.slice(0, 5)) {
      const pending = await listPendingTasksForGoal(goal.id, context.userId);
      candidates.push(...pending.slice(0, 3));
    }

    const uniqueCandidates = uniqueById(candidates)
      .filter((task: any) => task.status === 'pending');
    if (uniqueCandidates.length === 0) {
      return skippedAmauraResult('No pending task candidates for next action.');
    }

    const goalById = new Map(goals.map((goal: any) => [goal.id, goal]));
    const nextAction = uniqueCandidates
      .map((task: any) => ({
        task,
        score: scoreTask(task, goalById.get(task.goal_id)),
      }))
      .sort((a, b) => b.score - a.score)[0].task;
    const goal = goalById.get(nextAction.goal_id) ?? goals[0];
    const reason = buildReason(nextAction, goal);

    await serviceUpsertNextAction({
      userId: context.userId,
      goalId: nextAction.goal_id ?? goal?.id ?? null,
      task: nextAction,
      reason,
    });

    const notification = await createNotificationIfNotExists({
      userId: context.userId,
      goalId: nextAction.goal_id ?? goal?.id ?? null,
      type: 'next_action_updated',
      priority: 'low',
      title: "Today's mission updated",
      message: reason,
      actionLabel: 'Open mission',
      actionType: 'open_mission',
      actionPayload: { taskId: nextAction.id, goalId: nextAction.goal_id ?? null },
      dedupKey: `amaura:next-action:${context.userId}:${nextAction.id}:${context.now.toISOString().slice(0, 10)}`,
      metadata: { eventId: context.eventId, taskTitle: nextAction.title },
    });

    return emptyAmauraResult({
      actionsTaken: 1,
      notificationsCreated: notification ? 1 : 0,
      missionInvalidated: true,
    });
  },
};

function scoreTask(task: any, goal: any) {
  const today = new Date().toISOString().slice(0, 10);
  let score = 0;
  if (task.task_date && String(task.task_date) < today) score += 80;
  if (task.task_date === today) score += 40;
  if (task.priority === 'critical') score += 40;
  if (task.priority === 'high') score += 30;
  if (task.type === 'weak_concept_repair' || task.type === 'recovery') score += 30;
  if (goal?.risk_level === 'high' || goal?.metadata?.amaura_goal_loop?.riskLevel === 'high') score += 25;
  if (goal?.risk_level === 'medium' || goal?.metadata?.amaura_goal_loop?.riskLevel === 'medium') score += 10;
  score -= Math.min(Number(task.estimated_minutes ?? 15), 90) / 10;
  return score;
}

function buildReason(task: any, goal: any) {
  const goalTitle = goal?.title ? ` for ${goal.title}` : '';
  if (task.type === 'weak_concept_repair') {
    return `Chosen because this repairs ${task.topic ?? task.title}${goalTitle}.`;
  }
  if (task.task_date && String(task.task_date) < new Date().toISOString().slice(0, 10)) {
    return `Chosen because this pending task is overdue${goalTitle}.`;
  }
  return `Chosen because it is the highest-priority next step${goalTitle}.`;
}

function uniqueById(rows: any[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}
