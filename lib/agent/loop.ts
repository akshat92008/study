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
  CognitionAgentRuntimeOptions,
} from '@/lib/agent/types';
import { buildObservation, buildAgentPlan } from '@/lib/agent/planner';
import { HooksManager, createDefaultHooksManager } from '@/lib/agent/hooks';
import { executeDurableTool, executeToolChain, recordAgentStep } from '@/lib/agent/tools/executor';
import { logger } from '@/lib/utils/logger';
import { ToolCallBudget, IterationBudget } from '@/lib/agent/budget';
import { buildModelPlan, AgentPlanOutput } from '@/lib/agent/modelPlanner';
import { verifyAgentTurn } from '@/lib/agent/verifier';
import { getAllowedToolNames, getChannelPolicy } from '@/lib/agent/policy';
import { TOOL_CONFIGS } from '@/lib/agent/tools/toolsets';
import { nextRecommendedActionFromMutations } from '@/lib/mission/sessionProgressEngine';
import { applyResponseClaimGuard } from '@/lib/agent/guardrails/responseClaimGuard';
import { compileToolPlan, RuntimeState } from '@/lib/agent/toolCompiler';

/** Normalize a concept name to a canonical lookup key */
function conceptKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Check if a signal is actionable (has concept + sufficient confidence).
 */
function isActionableSignal(signal: LearningSignal): boolean {
  const conceptName = signal.canonicalConcept ?? signal.concept;
  if (!conceptName) return false;
  // Actionable signal types
  const actionableTypes = [
    'weak_area_detected',
    'misconception_detected',
    'revision_needed',
    'practice_needed',
    'wrong_answer',
    'session_completed',
    'autopsy_mistake',
    'source_used',
  ];
  if (!actionableTypes.includes(signal.type)) return false;
  // concept_understood only counts at higher confidence
  if (signal.type === 'concept_understood' && signal.confidence < 0.8) return false;
  // Default confidence threshold 0.55
  if (signal.confidence < 0.55) return false;
  return true;
}

/**
 * Returns true if there are signals that require mutation tools but those tools
 * are not yet in the requiredTools list. Used to force signal cascade injection.
 */
function needsSignalCascadeInjection(signals: LearningSignal[], requiredTools: Array<{ name: string }>): boolean {
  const hasActionable = signals.some(isActionableSignal);
  if (!hasActionable) return false;
  const signalMutatingTools = [
    'upsert_atlas_concept',
    'update_concept_mastery',
    'create_memory_card',
    'update_microtarget',
    'write_learning_event',
  ];
  const hasMutationTools = requiredTools.some(t => signalMutatingTools.includes(t.name));
  return !hasMutationTools;
}

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
 * Stable JSON string for call-key deduplication.
 * Recursively sorts keys so {b:1, a:2} and {a:2, b:1} produce the same string.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Generate a stable call key for deduplication.
 */
function stableCallKey(tool: { name: string; args: unknown }): string {
  return `${tool.name}:${stableStringify(tool.args ?? {})}`;
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
  options?: CognitionAgentRuntimeOptions;
}): Promise<CognitionAgentTurnOutput> {
  const { turn, context, trajectoryId, finalResponse, maxToolCalls = 40, hooks, options } = input;
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

  // Fix 2 & Fix 7: Add executedCallKeys and completedSignalMutations for deduplication + mutation tracking
  const runtimeState: RuntimeState = {
    conceptsByName: new Map<string, string>(),
    latestSignals: [] as LearningSignal[],
    sourceChunks: [] as RetrievedSourceChunk[],
    cardIds: [] as string[],
    toolResults: [] as ToolResultRecord[],
    executedCallKeys: new Set<string>(),
    completedSignalMutations: new Set<string>(),
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
  // Fix 7: Deduplicate context calls - skip already-executed identical calls
  const contextTools = [{ name: 'get_learner_context', args: {} }];
  if (observation.sourceRequested) {
    contextTools.push({ name: 'retrieve_source_chunks', args: { query: observation.userMessage } });
  }
  contextTools.push({ name: 'retrieve_agent_skills', args: {} });
  contextTools.push({ name: 'read_trajectory_context', args: { limit: 5 } });

  // Filter out already-executed calls (Fix 7)
  const pendingContextTools = contextTools.filter(tool => {
    const callKey = `${tool.name}:${JSON.stringify(tool.args)}`;
    if (runtimeState.executedCallKeys.has(callKey)) {
      logger.info('Skipping already-executed context tool', { tool: tool.name });
      return false;
    }
    runtimeState.executedCallKeys.add(callKey);
    return true;
  });

  const contextResults = pendingContextTools.length > 0
    ? await executeToolChain(pendingContextTools, {
    supabase,
    userId: context.userId,
    channel,
    runId: trajectoryId,
    toolCallsBudget,
    iterationsBudget,
    hooks: hooksMgr,
    context, // Fix 4: Pass original context
  })
    : [];

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

  const startTimeMs = Date.now();
  const maxRuntimeMs = options?.maxRuntimeMs ?? 60000;

  // 3. ITERATIVE LOOP (PLAN -> ACT -> REASON AGAIN)
  while (iterationsBudget.canContinue() && !hasFatalError) {
    if (Date.now() - startTimeMs > maxRuntimeMs) {
      allWarnings.push(`Agent loop reached maxRuntimeMs (${maxRuntimeMs}ms). Terminating gracefully.`);
      logger.warn('Agent loop reached maxRuntimeMs', { maxRuntimeMs, trajectoryId });
      break;
    }
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

      // Fix 1: Merge model/deterministic signals BEFORE compileToolPlan
      if (latestPlan.learning_signals?.length) {
        runtimeState.latestSignals.push(...latestPlan.learning_signals);
      }

      // Filter required_tools against policy
      const requiredTools = latestPlan.required_tools.filter(t => allowedToolNames.has(t.name));

      // Fix 1: Force signal cascade injection BEFORE compileToolPlan so injected tools are included in requiredTools
      if (needsSignalCascadeInjection(runtimeState.latestSignals, requiredTools)) {
        logger.info('Injecting missing signal cascade tools — model omitted mutation tools', {
          signalCount: runtimeState.latestSignals.filter(isActionableSignal).length,
        });
        requiredTools.push(
          { name: 'upsert_atlas_concept', input: { from: 'signals' } },
          { name: 'update_concept_mastery', input: {} },
          { name: 'create_memory_card', input: {} },
          { name: 'update_microtarget', input: {} },
          { name: 'write_learning_event', input: {} },
        );
      }

      // Now compile AFTER injection so injected tools are included
      const compiledTools = compileToolPlan({
        plannedTools: requiredTools,
        runtimeState,
        context,
        observation,
        finalResponse: finalResponseInstruction,
      });

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

      allWarnings.push(...latestPlan.risk_flags);

      // Break if no tools needed
      if (requiredTools.length === 0) {
        if ((latestPlan as any).final_response_instruction) {
          finalResponseInstruction = (latestPlan as any).final_response_instruction;
        }
        break;
      }

      // ACT
      // Fix 6 Phase: Dedupe compiled tools before execution
      const pendingCompiledTools = compiledTools.filter(tool => {
        const callKey = stableCallKey(tool);
        if (runtimeState.executedCallKeys.has(callKey)) {
          logger.info('Skipping already-executed compiled tool', { tool: tool.name, callKey });
          return false;
        }
        runtimeState.executedCallKeys.add(callKey);
        return true;
      });

      const iterResults = pendingCompiledTools.length > 0
        ? await executeToolChain(
            pendingCompiledTools, // Fix 6: Dedupe before execute
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
          )
        : [];

      // Track if a concept was created this round (for second-phase signal tool compile)
      let newConceptStored = false;
      for (const res of iterResults) {
        if (res.success && res.result) {
          runtimeState.toolResults.push(res.result);

          // Fix 7 & Fix 5: Update runtimeState from tool results
          if (res.toolName === 'upsert_atlas_concept' && res.result.data?.conceptId) {
            // Fix 5: Robust concept name resolution
            const conceptNameRaw =
              (res.result.data as any).concept?.name ??
              (res.result.data as any).conceptName ??
              (res.result.data as any).name ??
              (res.result.data as any).concept;

            if (conceptNameRaw && typeof conceptNameRaw === 'string') {
              // Fix 2 & Fix 3: Normalize concept key before storing
              const key = conceptKey(conceptNameRaw);
              if (!runtimeState.conceptsByName.has(key)) {
                newConceptStored = true;
              }
              runtimeState.conceptsByName.set(key, res.result.data.conceptId as string);
              logger.info('Stored conceptId in runtimeState', { conceptNameRaw, conceptId: res.result.data.conceptId });
            }
          }
          if (res.toolName === 'extract_learning_signals' && res.result.data?.signals) {
            runtimeState.latestSignals.push(...(res.result.data.signals as LearningSignal[]));
          }
          if (res.toolName === 'retrieve_source_chunks' && res.result.data?.chunks) {
            runtimeState.sourceChunks = res.result.data.chunks as RetrievedSourceChunk[];
            context.sourceChunks = runtimeState.sourceChunks;
          }
          if (res.toolName === 'create_memory_card') {
            // Fix 7: Handle multiple card ID patterns
            const cardId = res.result.entityIds?.[0]
              ?? (res.result.data as any)?.cardId
              ?? (Array.isArray((res.result.data as any)?.cards) ? (res.result.data as any).cards[0]?.id : null)
              ?? (Array.isArray((res.result.data as any)?.cardIds) ? (res.result.data as any).cardIds[0] : null);
            if (cardId) runtimeState.cardIds.push(cardId);
          }
          // Fix 7 & Phase 7: Merge signals from apply_practice_attempt, complete_session, record_autopsy_mistake
          if (
            (res.toolName === 'apply_practice_attempt' || res.toolName === 'complete_session' || res.toolName === 'record_autopsy_mistake') &&
            (res.result.data as any)?.signals
          ) {
            const signals = (res.result.data as any).signals as LearningSignal[];
            runtimeState.latestSignals.push(...signals);
          }

          // Fix 2: Track completed signal mutations (conceptKey + ':' + toolName)
          // Build reverse lookup: conceptId -> conceptKey (for first phase)
          const conceptIdToKey = new Map<string, string>();
          for (const [k, id] of runtimeState.conceptsByName) {
            conceptIdToKey.set(id, k);
          }
          const mutationTools = ['update_concept_mastery', 'create_memory_card', 'update_microtarget', 'write_learning_event'];
          if (mutationTools.includes(res.toolName) && res.result.changed) {
            // Find conceptKey: either from result conceptId or from the signal's concept name
            let conceptKeyForMutation: string | null = null;
            if ((res.result.data as any)?.conceptId && conceptIdToKey.has((res.result.data as any).conceptId)) {
              conceptKeyForMutation = conceptIdToKey.get((res.result.data as any).conceptId) ?? null;
            } else {
              // Fall back: find the first actionable signal with a known concept
              for (const sig of runtimeState.latestSignals) {
                const cn = sig.canonicalConcept ?? sig.concept;
                const ck = cn ? conceptKey(cn) : null;
                if (ck && runtimeState.conceptsByName.has(ck) && isActionableSignal(sig)) {
                  conceptKeyForMutation = ck;
                  break;
                }
              }
            }
            if (conceptKeyForMutation) {
              runtimeState.completedSignalMutations.add(`${conceptKeyForMutation}:${res.toolName}`);
              logger.info('Marked signal mutation complete', { mutation: `${conceptKeyForMutation}:${res.toolName}` });
            }
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

      // Fix 5: Second-phase compile after conceptId is known
      // If upsert_atlas_concept stored a new conceptId this round, pending signal tools
      // (update_concept_mastery, create_memory_card, update_microtarget, write_learning_event)
      // can now be compiled and executed before the next plan/reason cycle.
      if (newConceptStored) {
        const signalTools = compileToolPlan({
          plannedTools: [
            { name: 'update_concept_mastery', input: {} },
            { name: 'create_memory_card', input: {} },
            { name: 'update_microtarget', input: {} },
            { name: 'write_learning_event', input: {} },
          ],
          runtimeState,
          context,
          observation,
          finalResponse: finalResponseInstruction,
        });
        if (signalTools.length > 0) {
          // Fix 6 Phase: Dedupe second-phase tools before execution
          const pendingSecondPhase = signalTools.filter(tool => {
            const callKey = stableCallKey(tool);
            if (runtimeState.executedCallKeys.has(callKey)) {
              logger.info('Skipping already-executed second-phase tool', { tool: tool.name });
              return false;
            }
            runtimeState.executedCallKeys.add(callKey);
            return true;
          });

          const secondPhaseResults = pendingSecondPhase.length > 0
            ? await executeToolChain(pendingSecondPhase, {
                supabase,
                userId: context.userId,
                channel,
                runId: trajectoryId,
                toolCallsBudget,
                iterationsBudget,
                hooks: hooksMgr,
                context,
              })
            : [];
          for (const res of secondPhaseResults) {
            if (res.success && res.result) {
              runtimeState.toolResults.push(res.result);
              logger.info('Second-phase signal tool executed', { toolName: res.result.toolName, changed: res.result.changed });

              // Fix 2: Track completed signal mutations for second-phase tools
              const conceptIdToKey = new Map<string, string>();
              for (const [k, id] of runtimeState.conceptsByName) {
                conceptIdToKey.set(id, k);
              }
              const mutationTools = ['update_concept_mastery', 'create_memory_card', 'update_microtarget', 'write_learning_event'];
              if (mutationTools.includes(res.toolName) && res.result.changed) {
                let conceptKeyForMutation: string | null = null;
                if ((res.result.data as any)?.conceptId && conceptIdToKey.has((res.result.data as any).conceptId)) {
                  conceptKeyForMutation = conceptIdToKey.get((res.result.data as any).conceptId) ?? null;
                } else {
                  for (const sig of runtimeState.latestSignals) {
                    const cn = sig.canonicalConcept ?? sig.concept;
                    const ck = cn ? conceptKey(cn) : null;
                    if (ck && runtimeState.conceptsByName.has(ck) && isActionableSignal(sig)) {
                      conceptKeyForMutation = ck;
                      break;
                    }
                  }
                }
                if (conceptKeyForMutation) {
                  runtimeState.completedSignalMutations.add(`${conceptKeyForMutation}:${res.toolName}`);
                  logger.info('Marked second-phase signal mutation complete', { mutation: `${conceptKeyForMutation}:${res.toolName}` });
                }
              }

              await recordAgentStep(supabase, {
                runId: trajectoryId,
                userId: context.userId,
                stepIndex: stepIdx++,
                stepType: 'tool_call',
                content: { toolName: res.result.toolName, changed: res.result.changed, phase: 'second_compile' },
              }).catch((e: unknown) => logger.warn('recordAgentStep second-phase error', { error: String(e) }));
            } else if (!res.success) {
              allWarnings.push(...res.warnings, res.error?.message ?? `Second-phase ${res.toolName} failed`);
            }
          }
        }
      }

      // REASON AGAIN - check if we should continue
      // Fix 2: Check pending mutations by whether required mutation tools succeeded, not only conceptId existence
      const pendingSignalMutations = runtimeState.latestSignals.some(s => {
        const conceptName = s.canonicalConcept ?? s.concept;
        if (!conceptName) return false;
        if (!isActionableSignal(s)) return false;
        const key = conceptKey(conceptName);
        // If conceptId not yet stored, mutation tools cannot run
        if (!runtimeState.conceptsByName.has(key)) return true;
        // conceptId exists — check if all required mutation tools succeeded
        const requiredMutations = ['update_concept_mastery', 'create_memory_card', 'write_learning_event'];
        return requiredMutations.some(m => !runtimeState.completedSignalMutations.has(`${key}:${m}`));
      });
      // Fix 6: Do not break if pending signal mutations remain
      if (
        (!latestPlan?.pedagogical_next_step || (latestPlan.pedagogical_next_step as any)?.type !== 'continue') &&
        !pendingSignalMutations
      ) {
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

