import type { AgentToolDefinition } from '@/lib/agent/types';
import { CompleteSessionInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { completeLearningSession } from '@/lib/services/session-completion';
import { verifySessionCompletion } from '@/lib/agent/guardrails/sessionCompletionGuard';
import { recordAgentActivity, stableKey } from '@/lib/agent/tools/learning/common';

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
      durationMinutes: input.durationMinutes ?? 25,
      understood: input.understood ?? true,
      gapFound: typeof input.gapFound === 'boolean' ? input.gapFound : input.gapFound === 'true',
      cardsCreated: input.cardsCreated ?? 0,
      goalId: input.goalId ?? context.goalId ?? null,
      idempotencyKey: stableKey([context.idempotencyKey, 'complete-session', input.sessionId ?? context.sessionId]),
      source: 'session',
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

    return {
      success: true,
      changed: true,
      entityType: 'study_session',
      entityIds: [result.sessionId],
      summary: 'Session completion persisted and verified.',
      data: { ...result, verified: true },
    };
  },
};
