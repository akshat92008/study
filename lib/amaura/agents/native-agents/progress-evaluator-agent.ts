import { z } from 'zod';
import { AMAURA_EVENTS } from '@/lib/amaura/events/event-matrix';
import {
  computeGoalProgress,
  listActiveGoals,
  updateGoal,
} from '@/lib/amaura/goals/goal-repository';
import { createNotificationIfNotExists } from '@/lib/amaura/notifications/notification-repository';
import { listRecentObservations } from '@/lib/amaura/observations/observation-repository';
import { eventDedupKey } from '../idempotency';
import {
  AmauraAgentResultSchema,
  emptyAmauraResult,
  skippedAmauraResult,
  type AmauraAgentDefinition,
} from '../types';

const ProgressEvaluatorPayloadSchema = z.object({
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
}).passthrough();

type ProgressEvaluatorPayload = z.infer<typeof ProgressEvaluatorPayloadSchema>;

export const ProgressEvaluatorAgent: AmauraAgentDefinition<ProgressEvaluatorPayload> = {
  name: 'ProgressEvaluatorAgent',
  handledEvents: [
    AMAURA_EVENTS.AMAURA_GOAL_UPDATED,
    AMAURA_EVENTS.AMAURA_TASK_COMPLETED,
    AMAURA_EVENTS.AMAURA_TASK_SKIPPED,
    AMAURA_EVENTS.AMAURA_OBSERVATION_RECORDED,
    AMAURA_EVENTS.AUTOPSY_V3_REPORT_READY,
    AMAURA_EVENTS.MEMORY_REVIEW_COMPLETED,
    AMAURA_EVENTS.ATLAS_CONCEPT_UPDATED,
    AMAURA_EVENTS.SESSION_CLOSED,
    AMAURA_EVENTS.DAILY_AGENT_TICK,
  ],
  stateVisibleEffects: ['goal', 'notification'],
  inputSchema: ProgressEvaluatorPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('ProgressEvaluatorAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'event' },
  notification: { priority: 'normal', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = payload.goalId ?? payload.goal_id ?? context.goalId;
    const goals = goalId
      ? (await listActiveGoals(context.userId)).filter((goal: any) => goal.id === goalId)
      : await listActiveGoals(context.userId);
    if (goals.length === 0) return skippedAmauraResult('No active goals to evaluate.');

    const observations = await listRecentObservations(context.userId, 50);
    let actionsTaken = 0;
    let notificationsCreated = 0;

    for (const goal of goals.slice(0, 10)) {
      const progress = await computeGoalProgress(goal.id, context.userId);
      const goalObservations = observations.filter((row: any) =>
        row.goal_id === goal.id ||
        row.payload?.goalId === goal.id ||
        row.payload?.goal_id === goal.id
      );
      const weakCount = goalObservations.filter((row: any) =>
        ['weakness', 'confusion', 'repeated_error', 'autopsy_report'].includes(row.observation_type ?? row.evidence_type)
      ).length;
      const riskLevel = computeRisk(progress, weakCount);
      const blockers = goalObservations
        .map((row: any) => row.topic ?? row.payload?.weakTopic)
        .filter(Boolean)
        .slice(0, 5);

      await updateGoal(goal.id, context.userId, {
        progressPercent: progress.progressPercent,
        riskLevel,
        currentState: {
          totalTasks: progress.totalTasks,
          completedTasks: progress.completedTasks,
          skippedTasks: progress.skippedTasks,
          overdueTasks: progress.overdueTasks,
          weakObservations: weakCount,
          blockers,
          nextBestAction: blockers[0] ? `Repair ${blockers[0]}` : null,
          velocity: progress.completedTasks,
        },
        lastEvaluatedAt: context.now.toISOString(),
        metadata: {
          ...(goal.metadata ?? {}),
          amaura_goal_loop: {
            ...(goal.metadata?.amaura_goal_loop ?? {}),
            progressPercent: progress.progressPercent,
            riskLevel,
            blockers,
            lastEvaluatedAt: context.now.toISOString(),
          },
        },
      });
      actionsTaken++;

      if (riskLevel === 'high') {
        const notification = await createNotificationIfNotExists({
          userId: context.userId,
          goalId: goal.id,
          type: 'goal_risk',
          priority: 'important',
          title: 'Goal risk rising',
          message: `${goal.title ?? 'Your goal'} is slipping because ${riskReason(progress, weakCount)}.`,
          actionLabel: 'Open mission',
          actionType: 'open_mission',
          actionPayload: { goalId: goal.id },
          dedupKey: `amaura:progress-evaluator:${goal.id}:high-risk:${context.now.toISOString().slice(0, 10)}`,
          metadata: { eventId: context.eventId, progress, weakCount },
        });
        notificationsCreated += notification ? 1 : 0;
      }
    }

    return emptyAmauraResult({
      actionsTaken,
      notificationsCreated,
    });
  },
};

function computeRisk(
  progress: Awaited<ReturnType<typeof computeGoalProgress>>,
  weakCount: number
): 'low' | 'medium' | 'high' {
  if (progress.overdueTasks >= 3 || weakCount >= 3 || progress.skippedTasks >= 2) return 'high';
  if (progress.overdueTasks > 0 || weakCount > 0 || progress.skippedTasks > 0) return 'medium';
  return 'low';
}

function riskReason(progress: Awaited<ReturnType<typeof computeGoalProgress>>, weakCount: number) {
  if (progress.overdueTasks >= 3) return `${progress.overdueTasks} tasks are overdue`;
  if (weakCount >= 3) return 'several weak signals repeated';
  if (progress.skippedTasks >= 2) return `${progress.skippedTasks} tasks were skipped`;
  return 'recent progress slowed';
}
