import { completeAgentRun, createAgentSnapshot } from '@/lib/agents/agent-runtime';
import type { CognitionAgentTurnOutput, JsonObject } from '@/lib/agent/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function writeTrajectory(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  output: CognitionAgentTurnOutput;
  errors?: string[];
}) {
  const snapshot = {
    channel: input.output.agentPlan.answer_intent,
    contextSummary: input.output.contextSummary,
    sourceRetrievalSummary: input.output.sourceRetrievalSummary,
    agentPlan: input.output.agentPlan,
    toolCalls: input.output.toolCalls,
    toolResults: input.output.toolResults,
    learningSignals: input.output.learningSignals,
    mutationSummary: input.output.mutationSummary,
    verification: input.output.verification,
    finalResponseSummary: input.output.finalResponse?.slice(0, 500) ?? null,
    errors: input.errors ?? [],
  } satisfies JsonObject;

  await createAgentSnapshot({
    userId: input.userId,
    runId: input.runId,
    snapshotType: 'cognition_agent_trajectory',
    snapshot,
  }, { client: input.supabase as any });

  await completeAgentRun(input.runId, {
    mutationSummary: input.output.mutationSummary,
    verification: input.output.verification,
    signalCount: input.output.learningSignals.length,
  }, { client: input.supabase as any });
}

