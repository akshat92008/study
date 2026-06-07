import { completeAgentRun, createAgentSnapshot } from '@/lib/agents/agent-runtime';
import type { AgentObservation, CognitionAgentTurnInput, CognitionAgentTurnOutput, JsonObject } from '@/lib/agent/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function writeTrajectory(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  turn: CognitionAgentTurnInput;
  observation: AgentObservation;
  output: CognitionAgentTurnOutput;
  errors?: string[];
}) {
  const snapshot = {
    channel: input.turn.channel,
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

  // Fix 10: Populate agent_runs canonical columns
  const updateData: any = {
    channel: input.turn.channel,
    goal_id: input.turn.goalId ?? null,
    conversation_id: input.turn.conversationId ?? null,
    session_id: input.turn.sessionId ?? null,
    observation: input.observation as any,
    context_summary: input.output.contextSummary as any,
    source_summary: input.output.sourceRetrievalSummary as any,
    plan: input.output.agentPlan as any,
    learning_signals: input.output.learningSignals as any,
    mutation_summary: input.output.mutationSummary as any,
    verification: input.output.verification as any,
    final_response_summary: input.output.finalResponse?.slice(0, 500) ?? null,
    next_recommended_action: input.output.nextRecommendedAction as any,
    used_iterations: input.output.usedIterations || 0,
    used_tool_calls: input.output.usedToolCalls || 0,
    warnings: input.output.mutationSummary.warnings || [],
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await input.supabase
    .from('agent_runs')
    .update(updateData)
    .eq('id', input.runId);

  if (error) {
    console.warn('Failed to update agent_runs canonical columns', error);
    // Fallback to legacy completion if full update fails
    await completeAgentRun(input.runId, {
      mutationSummary: input.output.mutationSummary,
      verification: input.output.verification,
      signalCount: input.output.learningSignals.length,
    }, { client: input.supabase as any }).catch(() => undefined);
  }
}


