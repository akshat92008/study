import type { AgentToolDefinition } from '@/lib/agent/types';
import { GetLearnerContextInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { getMindStateSnapshot } from '@/lib/mind/get-mind-state-snapshot';

export const getLearnerContextTool: AgentToolDefinition<typeof GetLearnerContextInputSchema, typeof ToolResultSchema> = {
  name: 'get_learner_context',
  description: 'Load durable learner profile, active goal, mission, ATLAS, MEMORY, sources, recent events, attempts, and mistakes.',
  inputSchema: GetLearnerContextInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 1,
  requiresAuth: true,
  async handler(input, context) {
    const snapshot = await getMindStateSnapshot(context.supabase, {
      userId: context.userId,
      goalId: input.goalId ?? context.goalId ?? null,
      sessionId: context.sessionId,
      message: context.observation.userMessage,
      now: context.now,
    });
    const summary = {
      profile: snapshot.user,
      activeGoal: snapshot.activeGoal,
      dailyMission: snapshot.todaySession,
      atlas: {
        weakConcepts: snapshot.atlas.weakConcepts,
        learningConcepts: snapshot.atlas.recentlyImprovedConcepts,
        strongConcepts: snapshot.atlas.masteredConcepts,
        recentConcepts: snapshot.atlas.recentlyPracticedConcepts,
      },
      memory: { dueCount: snapshot.memory.dueCards.length, dueCards: snapshot.memory.dueCards },
      sources: {
        available: snapshot.sources.indexedSources,
        availableCount: snapshot.sources.indexedSources.length,
        relevantChunks: snapshot.sources.relevantChunks,
        sourceGroundingAvailable: snapshot.guardrails.sourceGroundingAvailable,
      },
      recent: {
        learningSignals: snapshot.recentLearningEvents,
        practiceAttempts: snapshot.atlas.recentlyPracticedConcepts,
        mistakes: snapshot.autopsy.unresolvedMistakes,
        chatTurns: snapshot.recentChatTurns,
      },
      guardrails: snapshot.guardrails,
      warnings: [],
    };

    context.contextSummary = summary;

    return {
      success: true,
      changed: false,
      entityType: 'learner_context',
      entityIds: [context.userId],
      summary: `Loaded learner context with ${snapshot.atlas.weakConcepts.length} weak concepts, ${snapshot.sources.indexedSources.length} usable sources, and ${snapshot.memory.dueCards.length} due cards.`,
      data: summary,
    };
  },
};
