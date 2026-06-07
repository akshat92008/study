/**
 * Hermes-class Agent Loop for Cognition OS.
 *
 * Iterative model-driven loop replacing the deterministic pipeline.
 *
 * Flow: OBSERVE → CONTEXT → PLAN → (EXECUTE_TOOLS)* → VERIFY → RESPOND
 *
 * This implementation uses the true Hermes-class approach:
 * - Trajectory tracing via agent_steps records
 * - Lifecycle hooks at each phase (beforeAgentRun, afterToolCall, etc.)
 * - Iterative Model planning using ModelPlanner
 * - Error recovery with graceful fallback
 * - Budget tracking integration
 */
import type {
  CognitionAgentTurnInput,
  CognitionAgentTurnOutput,
  AgentToolContext,
  LearningSignal,
  RetrievedSourceChunk,
  JsonObject,
  MutationSummary,
  VerificationResult,
  AgentPlan,
  ToolResultRecord,
} from '@/lib/agent/types';
import { buildObservation } from '@/lib/agent/planner';
import { HooksManager, createDefaultHooksManager } from '@/lib/agent/hooks';
import { executeDurableTool, executeToolChain, recordAgentStep } from '@/lib/agent/tools/executor';
import { logger } from '@/lib/utils/logger';
import { ToolCallBudget, IterationBudget } from '@/lib/agent/budget';
import { buildModelPlan, AgentPlanOutput } from '@/lib/agent/modelPlanner';
import { verifyAgentTurn } from '@/lib/agent/verifier';
import { getAllowedToolNames } from '@/lib/agent/policy';
import { TOOL_CONFIGS } from '@/lib/agent/tools/toolsets';
import { nextRecommendedActionFromMutations } from '@/lib/mission/sessionProgressEngine';
import { applyResponseClaimGuard } from '@/lib/agent/guardrails/responseClaimGuard';

function summarizeMutations(results: ToolResultRecord[]): MutationSummary {
  const summary: MutationSummary = {
    changed: results.some((result) => result.changed),
    eventsWritten: 0,
    conceptsCreated: 0,
    conceptsUpdated: 0,
    revisionCardsCreated: 0,
    microtargetsUpdated: 0,
    practiceAttemptsProcessed: 0,
    sessionsCompleted: 0,
    mistakesRecorded: 0,
    warnings: [],
  };

  for (const result of results) {
    if (!result.success) {
      summary.warnings.push(`${result.toolName}: ${result.error?.message ?? result.summary}`);
      continue;
    }
    if (!result.changed) continue;

    if (result.toolName === 'write_learning_event') summary.eventsWritten++;
    if (result.toolName === 'upsert_atlas_concept') summary.conceptsCreated++; // Actually upserted
    if (result.toolName === 'update_concept_mastery') summary.conceptsUpdated++;
    if (result.toolName === 'create_memory_card') summary.revisionCardsCreated++;
    if (result.toolName === 'update_microtarget') summary.microtargetsUpdated++;
    if (result.toolName === 'apply_practice_attempt') summary.practiceAttemptsProcessed++;
    if (result.toolName === 'complete_session') summary.sessionsCompleted++;
    if (result.toolName === 'record_autopsy_mistake') summary.mistakesRecorded++;
  }

  return summary;
}

/**
 * Hermes-class iterative agent loop.
 */
export async function runCognitionAgentLoop(input: {
  turn: CognitionAgentTurnInput;
  context: AgentToolContext;
  trajectoryId: string;
  finalResponse?: string;
  maxToolCalls?: number;
  hooks?: HooksManager;
}): Promise<CognitionAgentTurnOutput> {
  const { turn, context, trajectoryId, finalResponse, maxToolCalls = 40, hooks } = input;
  const hooksMgr = hooks ?? createDefaultHooksManager();
  const supabase = context.supabase;
  const channel = turn.channel;
  const observation = context.observation;

  logger.info('Hermes agent loop started', {
    channel,
    trajectoryId,
    userId: context.userId,
    maxToolCalls,
  });

  const iterationsBudget = new IterationBudget(channel);
  const toolCallsBudget = new ToolCallBudget(channel, maxToolCalls);

  const allWarnings: string[] = [];
  let stepIdx = 0;

  // Hooks: before agent run
  await hooksMgr.execute('beforeAgentRun', {
    runId: trajectoryId,
    userId: context.userId,
    channel,
    stepType: 'observe',
  }).catch((e: unknown) => logger.warn('beforeAgentRun hook error', { error: String(e) }));

  // 1. OBSERVE
  await recordAgentStep(supabase, {
    runId: trajectoryId,
    userId: context.userId,
    stepIndex: stepIdx++,
    stepType: 'observe',
    content: { channel, observation, userMessage: turn.userMessage?.slice(0, 500) },
  }).catch((e: unknown) => logger.warn('recordAgentStep observe error', { error: String(e) }));

  // 2. CONTEXT (Initial deterministic fetch)
  const contextTools = [{ name: 'get_learner_context', args: {} }];
  if (observation.sourceRequested) {
    contextTools.push({ name: 'retrieve_source_chunks', args: { query: observation.userMessage } });
  }
  contextTools.push({ name: 'retrieve_agent_skills', args: {} });
  contextTools.push({ name: 'read_trajectory_context', args: { limit: 5 } });

  const contextResults = await executeToolChain(contextTools, {
    supabase,
    userId: context.userId,
    channel,
    runId: trajectoryId,
    toolCallsBudget,
    iterationsBudget,
    hooks: hooksMgr,
  });

  let contextSummary: JsonObject = {};
  let sourceChunks: RetrievedSourceChunk[] = [];
  let skills: JsonObject[] = [];
  let allToolResults: ToolResultRecord[] = [];

  for (const res of contextResults) {
    if (res.success && res.result) {
      allToolResults.push(res.result);
      if (res.toolName === 'get_learner_context' && res.result.data) {
        contextSummary = res.result.data;
      }
      if (res.toolName === 'retrieve_source_chunks' && res.result.data?.chunks) {
        sourceChunks = res.result.data.chunks as RetrievedSourceChunk[];
      }
      if (res.toolName === 'retrieve_agent_skills' && res.result.data?.skills) {
        skills = res.result.data.skills as JsonObject[];
      }
    } else if (!res.success) {
      allWarnings.push(...res.warnings, res.error?.message ?? `Failed to execute ${res.toolName}`);
    }
  }

  // Record context step
  await recordAgentStep(supabase, {
    runId: trajectoryId,
    userId: context.userId,
    stepIndex: stepIdx++,
    stepType: 'observe', // Logical grouping
    content: { step: 'context_loaded', toolCount: contextTools.length },
  }).catch((e: unknown) => logger.warn('recordAgentStep context error', { error: String(e) }));

  const allowedToolNames = new Set(getAllowedToolNames(channel, TOOL_CONFIGS));
  let finalResponseInstruction = finalResponse;
  const allSignals: LearningSignal[] = [];
  let latestPlan: AgentPlan | AgentPlanOutput | null = null;
  let hasFatalError = false;

  // 3. ITERATIVE LOOP (PLAN -> ACT -> REASON AGAIN)
  while (iterationsBudget.canContinue() && !hasFatalError) {
    iterationsBudget.recordIteration();

    try {
      // PLAN
      latestPlan = await buildModelPlan({
        channel,
        userMessage: observation.userMessage,
        payload: observation.payload,
        contextSummary,
        sourceChunks: sourceChunks as any,
        learningSignals: allSignals,
        skills,
        allowedToolNames: Array.from(allowedToolNames),
      });

      // Filter required_tools against policy
      const requiredTools = latestPlan.required_tools.filter(t => allowedToolNames.has(t.name));

      await hooksMgr.execute('afterModelPlan', {
        runId: trajectoryId,
        userId: context.userId,
        channel,
        stepType: 'plan',
        toolResult: latestPlan as any,
      }).catch((e: unknown) => logger.warn('afterModelPlan hook error', { error: String(e) }));

      await recordAgentStep(supabase, {
        runId: trajectoryId,
        userId: context.userId,
        stepIndex: stepIdx++,
        stepType: 'plan',
        content: {
          answer_intent: latestPlan.answer_intent,
          confidence: latestPlan.confidence,
          toolCount: requiredTools.length,
          signals: latestPlan.learning_signals.length,
          plan_source: latestPlan.plan_source,
        },
      }).catch((e: unknown) => logger.warn('recordAgentStep plan error', { error: String(e) }));

      allSignals.push(...latestPlan.learning_signals);
      allWarnings.push(...latestPlan.risk_flags);

      // Break if no tools needed
      if (requiredTools.length === 0) {
        if ((latestPlan as any).final_response_instruction) {
          finalResponseInstruction = (latestPlan as any).final_response_instruction;
        }
        break;
      }

      // ACT
      const iterResults = await executeToolChain(
        requiredTools.map(t => ({ name: t.name, args: t.input })),
        {
          supabase,
          userId: context.userId,
          channel,
          runId: trajectoryId,
          toolCallsBudget,
          iterationsBudget,
          hooks: hooksMgr,
        }
      );

      for (const res of iterResults) {
        if (res.success && res.result) {
          allToolResults.push(res.result);
          await recordAgentStep(supabase, {
            runId: trajectoryId,
            userId: context.userId,
            stepIndex: stepIdx++,
            stepType: 'tool_call',
            content: {
              toolName: res.result.toolName,
              changed: res.result.changed,
              entityType: res.result.entityType,
            },
          }).catch((e: unknown) => logger.warn('recordAgentStep tool_call error', { error: String(e) }));
        } else if (!res.success) {
          allWarnings.push(...res.warnings, res.error?.message ?? `Failed to execute ${res.toolName}`);
        }
      }

      // REASON AGAIN - check if we should continue
      if (!latestPlan?.pedagogical_next_step || (latestPlan.pedagogical_next_step as any)?.type !== 'continue') {
        if ((latestPlan as any)?.final_response_instruction) {
          finalResponseInstruction = (latestPlan as any).final_response_instruction;
        }
        break;
      }
    } catch (error) {
      hasFatalError = true;
      const message = error instanceof Error ? error.message : String(error);
      allWarnings.push(`Fatal error during iteration: ${message}`);
      logger.error('Agent loop iteration failed', { trajectoryId, error: message });
    }
  }

  // 6. VERIFY
  const verification = await verifyAgentTurn({
    supabase,
    userId: context.userId,
    observation,
    sourceChunks,
    toolResults: allToolResults,
  });

  if (verification.warnings?.length) allWarnings.push(...verification.warnings);
  if (verification.errors?.length) allWarnings.push(...verification.errors.map(e => `verification_error: ${e}`));

  const mutationSummary = summarizeMutations(allToolResults);
  mutationSummary.warnings = allWarnings;

  // 7. RESPOND & 8. REMEMBER/ADAPT
  await hooksMgr.execute('beforeResponse', {
    runId: trajectoryId,
    userId: context.userId,
    channel,
    stepType: 'respond',
  }).catch((e: unknown) => logger.warn('beforeResponse hook error', { error: String(e) }));

  await recordAgentStep(supabase, {
    runId: trajectoryId,
    userId: context.userId,
    stepIndex: stepIdx++,
    stepType: 'respond',
    content: {
      verificationOk: verification.ok,
      mutationsChanged: mutationSummary.changed,
    },
  }).catch((e: unknown) => logger.warn('recordAgentStep respond error', { error: String(e) }));

  await hooksMgr.execute('afterResponse', {
    runId: trajectoryId,
    userId: context.userId,
    channel,
    stepType: 'respond',
  }).catch((e: unknown) => logger.warn('afterResponse hook error', { error: String(e) }));

  await hooksMgr.execute('afterAgentRun', {
    runId: trajectoryId,
    userId: context.userId,
    channel,
    stepType: 'respond',
  }).catch((e: unknown) => logger.warn('afterAgentRun hook error', { error: String(e) }));

  logger.info('Hermes agent loop completed', {
    trajectoryId,
    verificationOk: verification.ok,
    mutationsChanged: mutationSummary.changed,
    toolsExecuted: allToolResults.length,
    iterationsUsed: iterationsBudget.used,
  });

  const agentPlan = latestPlan ?? {
    answer_intent: 'fallback',
    observations: [],
    learning_signals: allSignals,
    required_tools: [],
    expected_mutations: [],
    pedagogical_next_step: { type: 'continue' },
    confidence: 1,
    risk_flags: [],
    plan_source: 'deterministic',
  };

  const nextRecommendedAction = nextRecommendedActionFromMutations(mutationSummary as any);

  // Apply response claim guard to filter unverified state change claims
  const claimGuardResult = applyResponseClaimGuard(
    finalResponseInstruction,
    mutationSummary,
    verification
  );

  if (claimGuardResult.removedClaims.length > 0) {
    allWarnings.push(...claimGuardResult.removedClaims);
    logger.info('Response claim guard filtered unverified claims', {
      trajectoryId,
      removedClaims: claimGuardResult.removedClaims,
      hadVerifiedClaims: claimGuardResult.hasVerifiedClaims,
    });
  }

  return {
    finalResponse: claimGuardResult.filteredResponse || finalResponseInstruction,
    trajectoryId,
    contextSummary: contextSummary as any,
    sourceRetrievalSummary: {
      requested: observation.sourceRequested,
      chunkCount: sourceChunks.length,
      chunkIds: sourceChunks.map(c => c.id),
      verified: true
    },
    agentPlan: agentPlan as AgentPlan,
    toolCalls: allToolResults.map(r => ({ id: r.id, name: r.toolName, input: {}, startedAt: r.startedAt })),
    toolResults: allToolResults,
    learningSignals: allSignals,
    mutationSummary,
    verification,
    nextRecommendedAction,
  };
}
