import { z } from 'zod';
import { AMAURA_EVENTS } from '@/lib/amaura/events/event-matrix';
import { getGoal } from '@/lib/amaura/goals/goal-repository';
import { createNotificationIfNotExists } from '@/lib/amaura/notifications/notification-repository';
import { serviceUpsertNextAction } from '@/lib/amaura/session/session-card-repository';
import { createTasksBulk } from '@/lib/amaura/tasks/task-repository';
import { eventDedupKey, normalizeTextKey } from '../idempotency';
import {
  AmauraAgentResultSchema,
  emptyAmauraResult,
  skippedAmauraResult,
  type AmauraAgentDefinition,
} from '../types';

const GoalCreatedPayloadSchema = z.object({
  goalId: z.string().optional(),
  goal_id: z.string().optional(),
  title: z.string().optional(),
  subject: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  sourceEventId: z.string().nullable().optional(),
}).passthrough();

type GoalCreatedPayload = z.infer<typeof GoalCreatedPayloadSchema>;

export const GoalDecomposerAgent: AmauraAgentDefinition<GoalCreatedPayload> = {
  name: 'GoalDecomposerAgent',
  handledEvents: [AMAURA_EVENTS.AMAURA_GOAL_CREATED],
  stateVisibleEffects: ['task', 'session_card', 'notification'],
  inputSchema: GoalCreatedPayloadSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('GoalDecomposerAgent', context, payload),
  budget: { maxAiCalls: 0, model: 'none', requireBudget: false },
  idempotency: { scope: 'event' },
  notification: { priority: 'normal', maxPerWindow: 1, windowHours: 24 },
  retry: { maxRetries: 2, retryable: true },
  async run(context, payload) {
    const goalId = payload.goalId ?? payload.goal_id ?? context.goalId;
    if (!goalId) return skippedAmauraResult('Goal id is required for decomposition.');

    const goal = await getGoal(goalId, context.userId);
    if (!goal) return skippedAmauraResult('Goal was not found for user.');

    const focusTopic = inferFocusTopic(payload.topic ?? goal.metadata?.amaura_goal_loop?.focusTopic ?? goal.title);
    const subject = payload.subject ?? goal.subject ?? inferSubject(focusTopic);
    const tasks = await createTasksBulk(buildInitialTasks({
      userId: context.userId,
      goalId,
      title: goal.title ?? payload.title ?? focusTopic,
      focusTopic,
      subject,
      sourceEventId: context.eventId,
      now: context.now,
    }));
    const pending = tasks.find((task: any) => task.status === 'pending') ?? tasks[0] ?? null;

    if (pending) {
      await serviceUpsertNextAction({
        userId: context.userId,
        goalId,
        task: pending,
        reason: `Chosen because it starts the plan for ${focusTopic}.`,
      });
    }

    const notification = await createNotificationIfNotExists({
      userId: context.userId,
      goalId,
      type: 'goal_decomposed',
      priority: 'normal',
      title: 'Goal plan ready',
      message: `I created your first plan for ${goal.title ?? focusTopic}.`,
      actionLabel: 'Open goal',
      actionType: 'open_goal',
      actionPayload: { goalId },
      dedupKey: `amaura:goal-decomposer:${goalId}:v1`,
      metadata: {
        eventId: context.eventId,
        taskCount: tasks.length,
      },
    });

    return emptyAmauraResult({
      actionsTaken: tasks.length + (pending ? 1 : 0),
      notificationsCreated: notification ? 1 : 0,
      missionInvalidated: Boolean(pending),
    });
  },
};

function buildInitialTasks(input: {
  userId: string;
  goalId: string;
  title: string;
  focusTopic: string;
  subject: string;
  sourceEventId: string;
  now: Date;
}) {
  const shortGoal = isShortGoal(input.title);
  const templates: Array<[string, string, number, 'high' | 'medium']> = shortGoal
    ? [
        ['Map the highest-yield scope', 'concept', 15, 'high'],
        ['Do focused repair questions', 'practice', 25, 'high'],
        ['Review mistakes and formulas', 'revision', 18, 'medium'],
      ]
    : [
        ['Map the scope', 'concept', 15, 'high'],
        ['Practice core questions', 'practice', 25, 'medium'],
        ['Review mistakes', 'revision', 20, 'medium'],
        ['Take a timed checkpoint', 'timed_microtest', 20, 'medium'],
      ];

  return templates.slice(0, 7).map(([prefix, type, minutes, priority], index) => ({
    userId: input.userId,
    goalId: input.goalId,
    title: `${prefix} for ${input.focusTopic}`,
    subject: input.subject,
    topic: input.focusTopic,
    type,
    estimatedMinutes: Number(minutes),
    priority: String(priority) as 'high' | 'medium',
    taskDate: toDateKey(addDays(input.now, Math.min(index, 2))),
    sourceAgent: 'amaura_goal_decomposer',
    sourceEventId: input.sourceEventId,
    dedupKey: `goal_decomposer:${input.goalId}:task:${index}:v1`,
    successCriteria: {
      focusTopic: input.focusTopic,
      expectedOutput: type === 'practice' ? 'attempted_questions' : 'written_summary',
    },
    metadata: {
      agent: 'GoalDecomposerAgent',
      sourceTitle: input.title,
    },
  }));
}

function inferFocusTopic(value: string) {
  const raw = value.match(/\bmaster\s+(.+?)(?:\s+in\s+\d{1,3}\s+days?\b|$)/i)?.[1] ?? value;
  return raw.trim().replace(/[.?!]+$/g, '') || 'the goal';
}

function inferSubject(topic: string) {
  if (/kinematics|motion|force|work|energy|physics/i.test(topic)) return 'Physics';
  if (/organic|goc|chemistry|electrochem/i.test(topic)) return 'Chemistry';
  if (/biology|botany|zoology|genetics|ecology/i.test(topic)) return 'Biology';
  return 'General';
}

function isShortGoal(title: string) {
  const days = Number(title.match(/\bin\s+(\d{1,3})\s+days?\b/i)?.[1] ?? Number.NaN);
  return Number.isFinite(days) && days <= 7;
}

function addDays(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function goalDecomposerDedupTopic(value: string) {
  return normalizeTextKey(value) ?? 'goal';
}
