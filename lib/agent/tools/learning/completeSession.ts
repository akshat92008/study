import type { AgentToolContext, AgentToolDefinition, LearningSignal } from '@/lib/agent/types';
import { CompleteSessionInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { completeLearningSession } from '@/lib/services/session-completion';
import { verifySessionCompletion } from '@/lib/agent/guardrails/sessionCompletionGuard';
import { recordAgentActivity, stableKey, upsertConcept } from '@/lib/agent/tools/learning/common';
import { createMemoryCardForSignal } from '@/lib/agent/tools/learning/createMemoryCard';

// Extend the result to include memory card creation
interface CompleteSessionExtendedResult extends ReturnType<typeof completeLearningSession> {
  memoryCardCreated?: boolean;
  memoryCardId?: string | null;
}

export const completeSessionTool: AgentToolDefinition<typeof CompleteSessionInputSchema, typeof ToolResultSchema> = {
  name: 'complete_session',
  description: 'Persist session completion, streak update, learner event, and verification.',
  inputSchema: CompleteSessionInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 1,
  requiresAuth: true,
  async handler(input, context) {
    const result = await completeLearningSession({
      userId: context.userId,
      taskId: input.sessionId ?? context.sessionId ?? null,
      subject: input.subject ?? null,
      chapter: input.chapter ?? input.conceptName ?? null,
      conceptName: input.conceptName ?? input.chapter ?? null,
      durationMinutes: input.durationMinutes ?? null,
      understood: input.understood ?? true,
      gapFound: input.gapFound ?? null,
      cardsCreated: input.cardsCreated ?? 0,
      goalId: input.goalId ?? context.goalId ?? null,
      idempotencyKey: stableKey([context.idempotencyKey, 'complete-session', input.sessionId ?? context.sessionId]),
      source: 'complete_session',
      client: context.supabase,
    });

    const verified = await verifySessionCompletion(context.supabase, {
      userId: context.userId,
      sessionId: result.sessionId,
      goalId: input.goalId ?? context.goalId ?? null,
    });
    if (!verified) throw new Error('Session completion write could not be verified.');

    await recordAgentActivity(context.supabase, {
      userId: context.userId,
      runId: context.runId,
      agentName: 'planner',
      actionType: 'session_completed',
      targetType: 'study_session',
      targetId: result.sessionId,
      confidence: 1,
      evidence: result as any,
      reason: 'Session completion persisted and verified.',
      idempotencyKey: stableKey([context.idempotencyKey, 'session-completed', result.sessionId]),
    });

    // MEMORY card creation for completed session concept
    // This ensures session completion always creates a durable review card
    let memoryCardCreated = false;
    let memoryCardId: string | null = null;

    if (result.conceptId) {
      // Ensure concept exists in ATLAS
      const concept = await upsertConcept(context.supabase, {
        userId: context.userId,
        goalId: input.goalId ?? context.goalId ?? null,
        concept: input.conceptName ?? input.chapter ?? 'Session Concept',
        subject: input.subject ?? null,
        chapter: input.chapter ?? input.conceptName ?? null,
        topic: input.conceptName ?? input.chapter ?? null,
      });

      if (concept.conceptId) {
        const sessionSignal: LearningSignal = {
          type: 'session_completed',
          concept: input.conceptName ?? input.chapter ?? 'Session Concept',
          canonicalConcept: input.conceptName ?? input.chapter ?? 'Session Concept',
          subject: input.subject ?? null,
          chapter: input.chapter ?? null,
          topic: input.conceptName ?? null,
          confidence: 0.75,
          source: 'session' as const,
          correct: true,
          evidence: `Completed a study session on ${input.subject ?? 'General'} / ${input.chapter ?? input.conceptName ?? 'Session'}.`,
        };

        const memoryResult = await createMemoryCardForSignal(context, {
          conceptId: concept.conceptId,
          signal: sessionSignal,
          goalId: input.goalId ?? context.goalId ?? null,
        });

        memoryCardCreated = memoryResult.created;
        memoryCardId = memoryResult.cardId;

        if (memoryCardCreated) {
          await recordAgentActivity(context.supabase, {
            userId: context.userId,
            runId: context.runId,
            agentName: 'memory',
            actionType: 'memory_card_created',
            targetType: 'revision_card',
            targetId: memoryCardId,
            confidence: 0.75,
            evidence: { conceptId: concept.conceptId, sessionId: result.sessionId },
            reason: `MEMORY created a review card for completed session: ${input.conceptName ?? input.chapter ?? 'Session'}.`,
            idempotencyKey: stableKey([context.idempotencyKey, 'memory-card-session', result.sessionId]),
          });
        }
      }
    }

    return {
      success: true,
      changed: true,
      entityType: 'study_session',
      entityIds: [result.sessionId, ...(memoryCardId ? [memoryCardId] : [])],
      summary: memoryCardCreated
        ? `Session completion persisted and verified. MEMORY card created for ${input.conceptName ?? input.chapter ?? 'session'}.`
        : 'Session completion persisted and verified.',
      data: { ...result, verified: true, memoryCardCreated, memoryCardId },
    };
  },
};
