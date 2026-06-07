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
  const policy = getChannelPolicy(channel);

  const allWarnings: string[] = [];
  let stepIdx = 0;

  // Fix 7: Add runtimeState to loop for tool-output chaining
  const runtimeState = {
    conceptsByName: new Map<string, string>(),
    latestSignals: [] as LearningSignal[],
    sourceChunks: [] as RetrievedSourceChunk[],
    cardIds: [] as string[],
    toolResults: [] as ToolResultRecord[],
  };

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
    context, // Fix 4: Pass original context
  });

  let contextSummary: JsonObject = {};
  let skills: JsonObject[] = [];

  for (const res of contextResults) {
    if (res.success && res.result) {
      runtimeState.toolResults.push(res.result);
      if (res.toolName === 'get_learner_context' && res.result.data) {
        contextSummary = res.result.data;
      }
      if (res.toolName === 'retrieve_source_chunks' && res.result.data?.chunks) {
        runtimeState.sourceChunks = res.result.data.chunks as RetrievedSourceChunk[];
      }
      if (res.toolName === 'retrieve_agent_skills' && res.result.data?.skills) {
        skills = res.result.data.skills as JsonObject[];
      }
    } else if (!res.success) {
      allWarnings.push(...res.warnings, res.error?.message ?? `Failed to execute ${res.toolName}`);
    }
  }

  // Update context with retrieved chunks for subsequent tools
  context.sourceChunks = runtimeState.sourceChunks;
  context.contextSummary = contextSummary as any;

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
  let latestPlan: AgentPlan | AgentPlanOutput | null = null;
  let hasFatalError = false;

  // 3. ITERATIVE LOOP (PLAN -> ACT -> REASON AGAIN)
  while (iterationsBudget.canContinue() && !hasFatalError) {
    iterationsBudget.recordIteration();

    try {
      // PLAN
      // Fix 6: Enforce allowModelPlanning policy. If false, use deterministic fallback directly.
      if (policy.allowModelPlanning) {
        latestPlan = await buildModelPlan({
          channel,
          observation, // Fix 6: Pass real observation
          userMessage: observation.userMessage,
          payload: observation.payload,
          contextSummary,
          sourceChunks: runtimeState.sourceChunks as any,
          learningSignals: runtimeState.latestSignals,
          skills,
          allowedToolNames: Array.from(allowedToolNames),
        });
      } else {
        logger.info('Using deterministic plan due to policy', { channel });
        const deterministic = buildAgentPlan({
          observation,
          signals: runtimeState.latestSignals,
          sourceChunks: runtimeState.sourceChunks,
        });
        latestPlan = {
          ...deterministic,
          plan_source: 'deterministic',
          observations: [],
        } as AgentPlanOutput;
      }

      // Filter required_tools against policy
      const requiredTools = latestPlan.required_tools.filter(t => allowedToolNames.has(t.name));

      // Fix 7: Tool-output chaining - Resolve concept IDs from runtimeState before execution
      for (const tool of requiredTools) {
        if ((tool.name === 'update_concept_mastery' || tool.name === 'create_memory_card') && !tool.input.conceptId) {
          const conceptName = (tool.input as any).conceptName || (tool.input as any).concept || (tool.input as any).topic;
          if (conceptName && runtimeState.conceptsByName.has(conceptName)) {
            tool.input.conceptId = runtimeState.conceptsByName.get(conceptName);
            logger.info('Resolved conceptId from runtimeState', { toolName: tool.name, conceptName, conceptId: tool.input.conceptId });
          }
        }
      }

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

      // Merge signals from plan into runtimeState
      if (latestPlan.learning_signals?.length) {
        runtimeState.latestSignals.push(...latestPlan.learning_signals);
      }
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
          context, // Fix 4: Pass original context
        }
      );

      for (const res of iterResults) {
        if (res.success && res.result) {
          runtimeState.toolResults.push(res.result);
          
          // Fix 7: Update runtimeState from tool results
          if (res.toolName === 'upsert_atlas_concept' && res.result.data?.conceptId) {
            const conceptName = (res.result.data as any).name || (res.result.data as any).concept;
            if (conceptName) runtimeState.conceptsByName.set(conceptName, res.result.data.conceptId as string);
          }
          if (res.toolName === 'extract_learning_signals' && res.result.data?.signals) {
            runtimeState.latestSignals.push(...(res.result.data.signals as LearningSignal[]));
          }
          if (res.toolName === 'retrieve_source_chunks' && res.result.data?.chunks) {
            runtimeState.sourceChunks = res.result.data.chunks as RetrievedSourceChunk[];
            context.sourceChunks = runtimeState.sourceChunks;
          }

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
    runId: trajectoryId, // Fix 9: Pass runId
    observation,
    sourceChunks: runtimeState.sourceChunks,
    toolResults: runtimeState.toolResults,
  });

  if (verification.warnings?.length) allWarnings.push(...verification.warnings);
  if (verification.errors?.length) allWarnings.push(...verification.errors.map(e => `verification_error: ${e}`));

  const mutationSummary = summarizeMutations(runtimeState.toolResults);
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
    toolsExecuted: runtimeState.toolResults.length,
    iterationsUsed: iterationsBudget.used,
  });

  const agentPlan = latestPlan ?? {
    answer_intent: 'fallback',
    observations: [],
    learning_signals: runtimeState.latestSignals,
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
      chunkCount: runtimeState.sourceChunks.length,
      chunkIds: runtimeState.sourceChunks.map(c => c.id),
      verified: true
    },
    agentPlan: agentPlan as AgentPlan,
    toolCalls: runtimeState.toolResults.map(r => ({ id: r.id, name: r.toolName, input: {}, startedAt: r.startedAt })),
    toolResults: runtimeState.toolResults,
    learningSignals: runtimeState.latestSignals,
    mutationSummary,
    verification,
    nextRecommendedAction,
    usedIterations: iterationsBudget.used, // Fix 10: Populate usage stats
    usedToolCalls: runtimeState.toolResults.length, // Fix 10: Populate usage stats
  };
}

