import type { SupabaseClient } from '@supabase/supabase-js';
import { runCognitionAgentTurn } from '@/lib/agent/runtime';
import type { CognitionAgentTurnOutput, JsonObject, MutationSummary } from '@/lib/agent/types';

export interface RunMindTurnInput {
  supabase: SupabaseClient;
  userId: string;
  sessionId?: string | null;
  conversationId?: string | null;
  goalId?: string | null;
  userMessage: string;
  assistantText?: string | null;
  retrievedChunks?: unknown[];
  metadata?: JsonObject;
  idempotencyKey?: string;
}

export interface RunMindTurnResult {
  ok: boolean;
  mutationSummary: MutationSummary;
  learningSignalSummary: string;
  trajectoryId: string;
  runtime: CognitionAgentTurnOutput;
}

export async function runMindTurn(input: RunMindTurnInput): Promise<RunMindTurnResult> {
  const runtime = await runCognitionAgentTurn({
    userId: input.userId,
    channel: 'chat',
    userMessage: input.userMessage,
    sessionId: input.sessionId ?? undefined,
    conversationId: input.conversationId ?? input.sessionId ?? undefined,
    goalId: input.goalId ?? undefined,
    payload: {
      ...(input.metadata ?? {}),
      retrievedChunks: input.retrievedChunks ?? [],
    },
  }, {
    supabase: input.supabase,
    idempotencyKey: input.idempotencyKey,
    finalResponse: input.assistantText ?? undefined,
  });

  return {
    ok: runtime.verification.ok,
    mutationSummary: runtime.mutationSummary,
    learningSignalSummary: buildMindSummary(runtime.mutationSummary, runtime.verification.ok),
    trajectoryId: runtime.trajectoryId,
    runtime,
  };
}

function buildMindSummary(summary: MutationSummary, verified: boolean): string {
  if (!verified) return '';
  const parts: string[] = [];
  if (summary.conceptsCreated > 0) parts.push(`${summary.conceptsCreated} topic${summary.conceptsCreated > 1 ? 's' : ''} tracked`);
  if (summary.conceptsUpdated > 0) parts.push('ATLAS updated');
  if (summary.revisionCardsCreated > 0) parts.push(`${summary.revisionCardsCreated} MEMORY card${summary.revisionCardsCreated > 1 ? 's' : ''} created`);
  if (summary.microtargetsUpdated > 0) parts.push('mission progress updated');
  if (summary.practiceAttemptsProcessed > 0) parts.push('practice processed');
  if (summary.sessionsCompleted > 0) parts.push('session completed');
  return parts.join(' | ');
}
