import { createHash } from 'node:crypto';
import {
  createNotificationForUser,
  createRevisionCardsForUser,
} from '@/lib/amaura/agents/repositories';
import { recordAgentAction } from '@/lib/agents/agent-runtime';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

type SupabaseLike = ReturnType<typeof createAdminClient> | any;

export type WeakConceptPlanChange = {
  conceptId: string | null;
  conceptName: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  reason?: string | null;
  sourceId?: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function stableHash(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);
}

function displayLabel(concept: WeakConceptPlanChange) {
  return concept.conceptName || concept.topic || concept.chapter || 'this weak concept';
}

function compactList(concepts: WeakConceptPlanChange[]) {
  return concepts
    .slice(0, 3)
    .map(displayLabel)
    .filter(Boolean)
    .join(', ');
}

export async function notifyWeakConceptPlanChange(input: {
  userId: string;
  goalId?: string | null;
  weakConcepts: WeakConceptPlanChange[];
  sourceEventId?: string | null;
  sourceType: string;
  client?: SupabaseLike;
}) {
  const deduped = new Map<string, WeakConceptPlanChange>();
  for (const concept of input.weakConcepts) {
    if (!concept.conceptId && !concept.conceptName && !concept.topic && !concept.chapter) continue;
    const key = concept.conceptId ?? `${concept.subject ?? ''}:${displayLabel(concept)}`.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, concept);
  }
  const weakConcepts = [...deduped.values()];
  if (weakConcepts.length === 0) {
    return { cardsCreated: 0, tasksCreated: 0, notified: false };
  }

  const supabase = input.client ?? createAdminClient();
  const date = todayIsoDate();
  const sourceEventId = input.sourceEventId ?? null;
  const sourceHash = stableHash({
    sourceType: input.sourceType,
    sourceEventId,
    goalId: input.goalId ?? null,
    concepts: weakConcepts.map((concept) => concept.conceptId ?? displayLabel(concept)),
  });

  const cards = await createRevisionCardsForUser(
    input.userId,
    weakConcepts.slice(0, 5).map((concept) => {
      const label = displayLabel(concept);
      const chapter = concept.chapter ?? concept.topic ?? label;
      return {
        goalId: input.goalId ?? null,
        conceptId: concept.conceptId,
        subject: concept.subject ?? null,
        chapter,
        front: `Explain ${label} and solve one similar question.`,
        back: [
          `Focus: ${label}.`,
          concept.reason ? `Why this is due: ${concept.reason}.` : null,
          'Review the concept, then answer one targeted practice question without notes.',
        ].filter(Boolean).join('\n'),
        dueAt: new Date().toISOString(),
        sourceType: 'weak_concept_repair',
        sourceId: `${input.sourceType}:${sourceEventId ?? concept.sourceId ?? sourceHash}:${concept.conceptId ?? stableHash(label)}`,
        metadata: {
          sourceType: input.sourceType,
          sourceEventId,
          reason: concept.reason ?? null,
          topic: concept.topic ?? null,
        },
      };
    }),
    { client: supabase }
  ).catch((error) => {
    logger.warn('Weak concept revision card creation failed', {
      userId: input.userId,
      sourceType: input.sourceType,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });

  const taskRows = weakConcepts.slice(0, 3).map((concept) => {
    const label = displayLabel(concept);
    const topic = concept.topic ?? concept.chapter ?? label;
    return {
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      concept_id: concept.conceptId,
      task_date: date,
      title: `Repair weak concept: ${label}`,
      subject: concept.subject ?? null,
      topic,
      type: 'practice',
      estimated_minutes: 20,
      target_count: 5,
      status: 'pending',
      priority: 'high',
      source: 'amaura',
      source_agent: 'learning_loop',
      source_event_id: sourceEventId,
      dedup_key: `weakness-task:${input.userId}:${input.goalId ?? 'global'}:${concept.conceptId ?? stableHash(label)}:${date}`,
      metadata: {
        sourceType: input.sourceType,
        reason: concept.reason ?? null,
      },
    };
  });

  let tasksCreated = 0;
  if (taskRows.length > 0) {
    const { data, error } = await supabase
      .from('daily_microtasks')
      .upsert(taskRows, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true })
      .select('id');

    if (error) {
      logger.warn('Weak concept microtask creation failed', {
        userId: input.userId,
        sourceType: input.sourceType,
        error: error.message,
      });
    } else {
      tasksCreated = data?.length ?? 0;
    }
  }

  const labels = compactList(weakConcepts);
  const plural = weakConcepts.length === 1 ? '' : 's';
  const message = `I noticed new weakness signal${plural} around ${labels}. I added focused review cards and shifted today's mission toward repairing ${labels}.`;

  const notification = await createNotificationForUser(
    input.userId,
    {
      goalId: input.goalId ?? null,
      type: 'weakness_plan_changed',
      priority: 'important',
      title: 'Next study task updated',
      message,
      actionLabel: 'Open today\'s mission',
      actionType: 'open_session_card',
      actionPayload: { goalId: input.goalId ?? null },
      dedupKey: `weakness-plan:${input.userId}:${input.goalId ?? 'global'}:${sourceHash}`,
      metadata: {
        sourceType: input.sourceType,
        sourceEventId,
        weakConcepts: weakConcepts.map((concept) => ({
          conceptId: concept.conceptId,
          conceptName: concept.conceptName,
          subject: concept.subject ?? null,
          chapter: concept.chapter ?? null,
          topic: concept.topic ?? null,
        })),
      },
    },
    { client: supabase }
  ).catch((error) => {
    logger.warn('Weak concept notification failed', {
      userId: input.userId,
      sourceType: input.sourceType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: input.goalId ?? null,
    sourceEventId,
  }).catch((error) => {
    logger.warn('Weak concept session-card invalidation failed', {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  await recordAgentAction({
    userId: input.userId,
    agentName: 'planner',
    actionType: 'adjust_next_session',
    targetType: 'daily_microtasks',
    status: 'applied',
    confidence: 0.9,
    evidence: {
      sourceType: input.sourceType,
      sourceEventId,
      weakConcepts: weakConcepts.length,
      cardsCreated: cards.length,
      tasksCreated,
      notificationId: notification?.id ?? null,
    },
    reason: message,
    idempotencyKey: `weakness_plan_action:${input.userId}:${sourceHash}`,
  }, { client: supabase }).catch((error) => {
    logger.warn('Weak concept plan action write failed', {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    cardsCreated: cards.length,
    tasksCreated,
    notified: Boolean(notification),
  };
}
