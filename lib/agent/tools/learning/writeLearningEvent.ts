import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema, WriteLearningEventInputSchema } from '@/lib/agent/tools/schemas';
import { stableKey } from '@/lib/agent/tools/learning/common';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';

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
    const idempotencyKey = input.idempotencyKey ?? stableKey([context.idempotencyKey, 'learning-event', input.eventType, JSON.stringify(input.payload).slice(0, 80)]);
    const concept = stringValue(input.payload.concept) ?? stringValue(input.payload.topic);
    const outcome = outcomeForEvent(input.eventType, input.payload);
    const projection = await applyLearningEvent(context.supabase, {
      userId: context.userId,
      goalId,
      source: context.channel === 'autopsy'
        ? 'autopsy'
        : context.channel === 'revision'
          ? 'revision'
          : context.channel === 'session'
            ? 'focus_session'
            : 'chat_practice',
      concept: {
        conceptId: stringValue(input.payload.conceptId),
        canonicalName: concept,
        subject: stringValue(input.payload.subject),
        chapter: stringValue(input.payload.chapter),
        topic: stringValue(input.payload.topic) ?? concept,
      },
      result: {
        outcome,
        confidence: numberValue(input.payload.confidence) ?? 0.8,
        mistakeType: stringValue(input.payload.mistakeType),
        explanation: stringValue(input.payload.evidence) ?? input.eventType.replace(/_/g, ' '),
      },
      artifact: {
        sourceMaterialId: stringValue(input.payload.materialId),
        sessionCardId: context.sessionId ?? undefined,
      },
      metadata: { ...input.payload, idempotencyKey },
    }, { context });

    if (!projection.ok) {
      return {
        success: false,
        changed: false,
        entityType: 'learning_event',
        entityIds: [],
        summary: projection.message,
        error: { code: projection.code, message: projection.message },
        data: { traceId: projection.traceId },
      };
    }

    return {
      success: true,
      changed: true,
      entityType: 'learning_event',
      entityIds: [projection.learningEventId, ...projection.revisionCardIds, ...projection.mistakeIds],
      summary: `Projected learner event ${input.eventType}.`,
      data: {
        ...projection,
        eventsWritten: 1,
        conceptsUpdated: projection.masteryBefore !== projection.masteryAfter ? 1 : 0,
        revisionCardsCreated: projection.revisionCardIds.length,
        mistakesRecorded: projection.mistakeIds.length,
      },
    };
  },
};

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function outcomeForEvent(eventType: string, payload: Record<string, unknown>) {
  if (payload.correct === true || eventType === 'concept_understood') return 'correct' as const;
  if (eventType === 'revision_reviewed') return 'reviewed' as const;
  if (eventType === 'session_completed') return 'completed' as const;
  if (eventType === 'explanation_generated') return 'partial' as const;
  return 'incorrect' as const;
}
