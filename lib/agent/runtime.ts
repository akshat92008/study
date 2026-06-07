import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { failAgentRun, startAgentRun } from '@/lib/agents/agent-runtime';
import type { AgentToolContext, CognitionAgentRuntimeOptions, CognitionAgentTurnInput, CognitionAgentTurnOutput } from '@/lib/agent/types';
import { buildObservation } from '@/lib/agent/planner';
import { runCognitionAgentLoop } from '@/lib/agent/loop';
import { writeTrajectory } from '@/lib/agent/tracing/writeTrajectory';

function hashTurn(input: CognitionAgentTurnInput, finalResponse?: string) {
  return createHash('sha256')
    .update(JSON.stringify({
      userId: input.userId,
      channel: input.channel,
      message: input.userMessage ?? '',
      sessionId: input.sessionId ?? null,
      goalId: input.goalId ?? null,
      payload: input.payload ?? {},
      finalResponse: finalResponse?.slice(0, 120) ?? '',
    }))
    .digest('hex')
    .slice(0, 32);
}

export async function runCognitionAgentTurn(
  input: CognitionAgentTurnInput,
  options: CognitionAgentRuntimeOptions = {}
): Promise<CognitionAgentTurnOutput> {
  const supabase = options.supabase ?? await createClient();
  const idempotencyKey = options.idempotencyKey ?? `cognition-turn:${hashTurn(input, options.finalResponse)}`;
  const now = options.now ?? new Date();
  const observation = buildObservation(input);

  const run = await startAgentRun({
    userId: input.userId,
    agentName: 'command',
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
      output,
      errors: output.verification.errors,
    });
    return output;
  } catch (error) {
    await failAgentRun(run.id, error, { client: supabase as any, errorCode: 'cognition_agent_turn_failed' }).catch(() => undefined);
    throw error;
  }
}

