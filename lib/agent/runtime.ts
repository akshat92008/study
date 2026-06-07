import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { failAgentRun, startAgentRun } from '@/lib/agents/agent-runtime';
import type { AgentToolContext, CognitionAgentRuntimeOptions, CognitionAgentTurnInput, CognitionAgentTurnOutput } from '@/lib/agent/types';
import { buildObservation } from '@/lib/agent/planner';
import { runCognitionAgentLoop } from '@/lib/agent/loop';
import { writeTrajectory } from '@/lib/agent/tracing/writeTrajectory';
import { logger } from '@/lib/utils/logger';

function hashTurn(input: CognitionAgentTurnInput) {
  return createHash('sha256')
    .update(JSON.stringify({
      userId: input.userId,
      channel: input.channel,
      message: input.userMessage ?? '',
      sessionId: input.sessionId ?? null,
      goalId: input.goalId ?? null,
      payload: input.payload ?? {},
      // Fix 8: Remove finalResponse from hash as it's an output/instruction, not an input trigger
    }))
    .digest('hex')
    .slice(0, 32);
}

export async function runCognitionAgentTurn(
  input: CognitionAgentTurnInput,
  options: CognitionAgentRuntimeOptions = {}
): Promise<CognitionAgentTurnOutput> {
  const supabase = options.supabase ?? await createClient();
  const idempotencyKey = options.idempotencyKey ?? `cognition-turn:${hashTurn(input)}`;
  const now = options.now ?? new Date();
  const observation = buildObservation(input);

  const run = await startAgentRun({
    userId: input.userId,
    agentName: 'cognition_runtime', // Fix 10: Use canonical agent name
    triggerType: 'request',
    triggerSource: input.channel,
    inputSnapshot: {
      channel: input.channel,
      userMessage: input.userMessage?.slice(0, 1000) ?? null,
      payload: input.payload ?? {},
      conversationId: input.conversationId ?? null,
      sessionId: input.sessionId ?? null,
      goalId: input.goalId ?? null,
      observation,
    },
    idempotencyKey,
  }, { client: supabase as any });

  // Fix 8: If run is already completed, return existing trajectory instead of rerunning tools
  if (run.status === 'completed' && run.idempotency_key === idempotencyKey) {
    const { data: snapshot } = await supabase
      .from('agent_state_snapshots')
      .select('snapshot')
      .eq('run_id', run.id)
      .eq('snapshot_type', 'cognition_agent_trajectory')
      .maybeSingle();
    
    if (snapshot?.snapshot) {
      logger.info('Returning existing completed agent run trajectory', { runId: run.id });
      return snapshot.snapshot as unknown as CognitionAgentTurnOutput;
    }
  }

  const context: AgentToolContext = {
    supabase,
    userId: input.userId,
    channel: input.channel,
    conversationId: input.conversationId ?? null,
    sessionId: input.sessionId ?? null,
    goalId: input.goalId ?? null,
    runId: run.id,
    idempotencyKey,
    now,
    observation,
  };

  try {
    const output = await runCognitionAgentLoop({
      turn: input,
      context,
      trajectoryId: run.id,
      finalResponse: options.finalResponse,
      maxToolCalls: options.maxToolCalls ?? 40,
    });
    await writeTrajectory({
      supabase,
      userId: input.userId,
      runId: run.id,
      turn: input,
      observation,
      output,
      errors: output.verification.errors,
    });
    return output;
  } catch (error) {
    await failAgentRun(run.id, error, { client: supabase as any, errorCode: 'cognition_agent_turn_failed' }).catch(() => undefined);
    throw error;
  }
}

