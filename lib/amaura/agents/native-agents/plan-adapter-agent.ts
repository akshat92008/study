import { z } from 'zod';
import { AMAURA_EVENTS } from '@/lib/amaura/events/event-matrix';
import { listActiveGoals } from '@/lib/amaura/goals/goal-repository';
import { createNotificationIfNotExists } from '@/lib/amaura/notifications/notification-repository';
import { listRecentObservations } from '@/lib/amaura/observations/observation-repository';
import {
  listOverdueTasks,
  listPendingTasksForGoal,
  rescheduleTask,
  serviceCreateRepairTask,
} from '@/lib/amaura/tasks/task-repository';
import { eventDedupKey, normalizeTextKey } from '../idempotency';
import {
  AmauraAgentResultSchema,
  emptyAmauraResult,
  skippedAmauraResult,
  type AmauraAgentDefinition,
} from '../types';

const PlanAdapterPayloadSchema = z.object({
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  weakTopic: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  sourceEventId: z.string().nullable().optional(),
}).passthrough();

type PlanAdapterPayload = z.infer<typeof PlanAdapterPayloadSchema>;

export const PlanAdapterAgent: AmauraAgentDefinition<PlanAdapterPayload> = {
  name: 'PlanAdapterAgent',
  handledEvents: [
    AMAURA_EVENTS.AMAURA_TASK_COMPLETED,
    AMAURA_EVENTS.AMAURA_TASK_SKIPPED,
    AMAURA_EVENTS.AMAURA_OBSERVATION_RECORDED,
    AMAURA_EVENTS.AUTOPSY_V3_REPORT_READY,
    AMAURA_EVENTS.ATLAS_CONCEPT_UPDATED,
    AMAURA_EVENTS.SESSION_CLOSED,
  ],
  stateVisibleEffects: ['task', 'notification'],
  inputSchema: PlanAdapterPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('PlanAdapterAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'event' },
  notification: { priority: 'normal', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goals = await listActiveGoals(context.userId);
    if (goals.length === 0) return skippedAmauraResult('No active goals to adapt.');

    const recentObservations = await listRecentObservations(context.userId, 20);
    const weakTopic = extractWeakTopic(payload, recentObservations);
    const matchingGoal = chooseGoal(goals, payload.goalId ?? payload.goal_id, weakTopic);
    if (!matchingGoal) return skippedAmauraResult('No matching goal for adaptation.');

    let actionsTaken = 0;
    let notificationsCreated = 0;
    const touchedTasks = new Set<string>();

    if (weakTopic) {
      const repairTask = await serviceCreateRepairTask({
        userId: context.userId,
        goalId: matchingGoal.id,
        title: `Repair weak spot: ${weakTopic}`,
        subject: matchingGoal.subject ?? inferSubject(weakTopic),
        topic: weakTopic,
        estimatedMinutes: 18,
        sourceAgent: 'amaura_plan_adapter',
        sourceEventId: context.eventId,
        dedupKey: `plan_adapter:${matchingGoal.id}:${normalizeTextKey(weakTopic)}:repair:v1`,
        adaptationReason: payload.reason ?? 'weak evidence detected',
        metadata: {
          agent: 'PlanAdapterAgent',
          eventType: context.eventType,
          sourceTaskId: payload.taskId ?? payload.task_id ?? null,
        },
      });
      if (repairTask?.id) {
        touchedTasks.add(repairTask.id);
        actionsTaken++;
      }

      const notification = await createNotificationIfNotExists({
        userId: context.userId,
        goalId: matchingGoal.id,
        type: 'plan_adapted',
        priority: 'important',
        title: 'Plan adapted',
        message: `I added a repair task for ${weakTopic}. Do it before the next new topic.`,
        actionLabel: 'Open mission',
        actionType: 'open_mission',
        actionPayload: { goalId: matchingGoal.id, taskId: repairTask?.id ?? null },
        dedupKey: `amaura:plan-adapter:${matchingGoal.id}:${normalizeTextKey(weakTopic)}:v1`,
        metadata: { eventId: context.eventId, weakTopic },
      });
      notificationsCreated += notification ? 1 : 0;
    }

    const overdue = await listOverdueTasks(context.userId);
    const pending = await listPendingTasksForGoal(matchingGoal.id, context.userId);
    const tomorrow = addDays(context.now, 1).toISOString();
    for (const task of overdue.filter((row: any) => row.goal_id === matchingGoal.id).slice(0, 3 - touchedTasks.size)) {
      if (touchedTasks.has(task.id)) continue;
      await rescheduleTask(task.id, context.userId, tomorrow, 'overdue task repaired by plan adapter');
      touchedTasks.add(task.id);
      actionsTaken++;
    }

    if (actionsTaken === 0 && pending.length === 0) {
      return skippedAmauraResult('No safe adaptation was needed.');
    }

    return emptyAmauraResult({
      actionsTaken,
      notificationsCreated,
    });
  },
};

function extractWeakTopic(payload: PlanAdapterPayload, observations: any[]) {
  const direct = payload.weakTopic ?? payload.topic;
  if (direct?.trim()) return direct.trim();

  const observation = observations.find((row: any) =>
    ['weakness', 'confusion', 'repeated_error', 'autopsy_report'].includes(row.observation_type ?? row.evidence_type)
  );
  const fromPayload = observation?.payload?.weakTopic ?? observation?.payload?.topic;
  return typeof fromPayload === 'string' && fromPayload.trim()
    ? fromPayload.trim()
    : typeof observation?.topic === 'string'
      ? observation.topic
      : null;
}

function chooseGoal(goals: any[], goalId?: string | null, topic?: string | null) {
  if (goalId) return goals.find((goal) => goal.id === goalId) ?? null;
  if (!topic) return goals[0] ?? null;
  const key = topic.toLowerCase();
  return goals.find((goal) =>
    String(goal.title ?? '').toLowerCase().includes(key) ||
    String(goal.subject ?? '').toLowerCase().includes(key)
  ) ?? goals[0] ?? null;
}

function inferSubject(topic: string) {
  if (/kinematics|motion|force|work|energy|physics/i.test(topic)) return 'Physics';
  if (/organic|goc|chemistry|electrochem/i.test(topic)) return 'Chemistry';
  if (/biology|botany|zoology|genetics|ecology/i.test(topic)) return 'Biology';
  return 'General';
}

function addDays(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
