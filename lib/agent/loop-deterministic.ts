import type {
  AgentContextSummary,
  AgentPlan,
  AgentToolContext,
  CognitionAgentTurnInput,
  CognitionAgentTurnOutput,
  JsonObject,
  LearningSignal,
  MutationSummary,
  RetrievedSourceChunk,
  ToolResultRecord,
} from '@/lib/agent/types';
import { buildAgentPlan, buildObservation } from '@/lib/agent/planner';
import { createToolExecutionState, executeLearningTool } from '@/lib/agent/tools/executor';
import { verifyAgentTurn } from '@/lib/agent/verifier';
import { nextRecommendedActionFromMutations } from '@/lib/mission/sessionProgressEngine';

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function resultData<T = any>(result?: ToolResultRecord): T | null {
  if (!result?.success || !result.data) return null;
  return result.data as T;
}

function isConceptSignal(signal: LearningSignal) {
  return Boolean(signal.concept || signal.canonicalConcept)
    && [
      'weak_area_detected',
      'misconception_detected',
      'concept_understood',
      'revision_needed',
      'practice_needed',
      'explanation_generated',
      'revision_reviewed',
    ].includes(signal.type);
}

function shouldCreateMemory(signal: LearningSignal) {
  return ['weak_area_detected', 'misconception_detected', 'revision_needed', 'practice_needed'].includes(signal.type);
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
    if (result.toolName === 'write_learning_event' && result.changed) summary.eventsWritten += 1;
    if (result.toolName === 'upsert_atlas_concept' && result.changed) summary.conceptsCreated += 1;
    if (result.toolName === 'update_concept_mastery' && result.changed) summary.conceptsUpdated += 1;
    if (result.toolName === 'create_memory_card' && result.changed) summary.revisionCardsCreated += 1;
    if (result.toolName === 'update_microtarget' && result.changed) summary.microtargetsUpdated += Math.max(1, result.entityIds?.length ?? 0);
    if (result.toolName === 'complete_session' && result.changed) summary.sessionsCompleted += 1;
    if (result.toolName === 'record_autopsy_mistake' && result.changed) summary.mistakesRecorded += 1;
    if (result.toolName === 'apply_practice_attempt') {
      const data = result.data as any;
      summary.eventsWritten += Number(data?.eventsWritten ?? 0);
      summary.conceptsCreated += Number(data?.conceptsCreated ?? 0);
      summary.conceptsUpdated += Number(data?.conceptsUpdated ?? 0);
      summary.revisionCardsCreated += Number(data?.revisionCardsCreated ?? 0);
      summary.microtargetsUpdated += Number(data?.microtargetsUpdated ?? 0);
      summary.practiceAttemptsProcessed += Number(data?.practiceAttemptsProcessed ?? 0);
      summary.mistakesRecorded += Number(data?.mistakesRecorded ?? 0);
    }
  }
  return summary;
}

export async function runCognitionAgentLoop(input: {
  turn: CognitionAgentTurnInput;
  context: AgentToolContext;
  trajectoryId: string;
  finalResponse?: string;
  maxToolCalls: number;
}): Promise<CognitionAgentTurnOutput> {
  const observation = buildObservation(input.turn);
  input.context.observation = observation;
  const state = createToolExecutionState(input.maxToolCalls);

  const contextResult = await executeLearningTool('get_learner_context', {
    goalId: input.turn.goalId ?? null,
  }, input.context, state) as any;
  const contextSummary = (resultData<AgentContextSummary>(contextResult) ?? {}) as AgentContextSummary;
  input.context.contextSummary = contextSummary;

  let sourceChunks: RetrievedSourceChunk[] = [];
  const knownSourceCount = Number((contextSummary.sources as any)?.availableCount ?? 0);
  if (observation.sourceRequested || knownSourceCount > 0) {
    const retrieval = await executeLearningTool('retrieve_source_chunks', {
      query: observation.userMessage || String((observation.payload as any).query ?? ''),
      goalId: input.turn.goalId ?? null,
      limit: observation.sourceRequested ? 5 : 3,
      force: observation.sourceRequested,
    }, input.context, state);
    sourceChunks = asArray((retrieval.data as any)?.chunks) as RetrievedSourceChunk[];
    input.context.sourceChunks = sourceChunks;
  }

  const extraction = await executeLearningTool('extract_learning_signals', {
    userMessage: observation.userMessage,
    assistantMessage: input.finalResponse ?? '',
    channel: observation.channel,
    payload: observation.payload,
    retrievedChunks: sourceChunks,
    contextSummary: contextSummary as JsonObject,
  }, input.context, state);
  const learningSignals = asArray((extraction.data as any)?.signals) as LearningSignal[];
  input.context.learningSignals = learningSignals;

  const plan: AgentPlan = buildAgentPlan({
    observation,
    signals: learningSignals,
    sourceChunks,
  });

  await executeLearningTool('diagnose_weak_areas', {
    signals: learningSignals,
    recentContext: contextSummary.recent ?? {},
  }, input.context, state);

  if (observation.channel === 'practice' || observation.practicePayload) {
    await executeLearningTool('apply_practice_attempt', {
      practiceSetId: (observation.payload as any).practiceSetId,
      metrics: (observation.payload as any).metrics ?? {},
      items: (observation.payload as any).items ?? [],
      goalId: input.turn.goalId ?? null,
    }, input.context, state);
  } else if (observation.channel === 'autopsy' || observation.autopsyPayload) {
    const payload = observation.payload as any;
    if (payload.concept && payload.mistakeText) {
      await executeLearningTool('record_autopsy_mistake', {
        concept: payload.concept,
        mistakeText: payload.mistakeText,
        subject: payload.subject ?? null,
        chapter: payload.chapter ?? null,
        topic: payload.topic ?? null,
        correctAnswer: payload.correctAnswer ?? null,
        goalId: input.turn.goalId ?? null,
      }, input.context, state);
    }
  } else {
    for (const signal of learningSignals.filter((signal) => signal.type === 'source_used')) {
      await executeLearningTool('write_learning_event', {
        eventType: 'source_used',
        payload: {
          materialId: signal.materialId,
          materialTitle: signal.materialTitle,
          chunkIds: signal.chunkIds ?? [],
          confidence: signal.confidence,
          reason: `Source used: ${signal.materialTitle ?? 'uploaded material'}`,
        },
        goalId: input.turn.goalId ?? null,
      }, input.context, state);
      await executeLearningTool('update_microtarget', {
        eventType: 'source_used',
        goalId: input.turn.goalId ?? null,
      }, input.context, state);
    }

    for (const signal of learningSignals.filter(isConceptSignal)) {
      const conceptName = signal.canonicalConcept ?? signal.concept ?? signal.topic;
      if (!conceptName) continue;
      const upsert = await executeLearningTool('upsert_atlas_concept', {
        concept: conceptName,
        subject: signal.subject ?? null,
        chapter: signal.chapter ?? null,
        topic: signal.topic ?? conceptName,
        goalId: input.turn.goalId ?? null,
      }, input.context, state);
      const conceptId = (upsert.data as any)?.conceptId as string | undefined;
      if (!conceptId) continue;

      await executeLearningTool('update_concept_mastery', {
        conceptId,
        signal,
      }, input.context, state);

      if (shouldCreateMemory(signal)) {
        await executeLearningTool('create_memory_card', {
          conceptId,
          signal,
          sourceMaterialId: sourceChunks[0]?.materialId ?? null,
          goalId: input.turn.goalId ?? null,
        }, input.context, state);
      }

      await executeLearningTool('update_microtarget', {
        eventType: signal.type,
        conceptId,
        concept: conceptName,
        subject: signal.subject ?? null,
        topic: signal.topic ?? conceptName,
        goalId: input.turn.goalId ?? null,
      }, input.context, state);

      // update_concept_mastery applies the single canonical learning event.
    }
  }

  if (observation.sessionCompletionRequested) {
    await executeLearningTool('complete_session', {
      sessionId: input.turn.sessionId ?? (observation.payload as any).sessionId ?? null,
      subject: (observation.payload as any).subject ?? null,
      chapter: (observation.payload as any).chapter ?? null,
      conceptName: (observation.payload as any).conceptName ?? null,
      durationMinutes: (observation.payload as any).durationMinutes ?? null,
      understood: (observation.payload as any).understood ?? true,
      goalId: input.turn.goalId ?? null,
    }, input.context, state);
  }

  const weakConcepts = learningSignals
    .filter((signal) => ['weak_area_detected', 'misconception_detected', 'revision_needed', 'practice_needed'].includes(signal.type))
    .map((signal) => signal.canonicalConcept ?? signal.concept ?? '')
    .filter(Boolean);

  if (weakConcepts.length > 0) {
    await executeLearningTool('adapt_daily_plan', {
      reason: 'weak areas detected in current turn',
      weakConcepts,
      goalId: input.turn.goalId ?? null,
    }, input.context, state);
  }

  const mutationSummary = summarizeMutations(state.results);
  const verification = await verifyAgentTurn({
    supabase: input.context.supabase,
    userId: input.context.userId,
    runId: input.trajectoryId,
    observation,
    sourceChunks,
    toolResults: state.results,
  });

  return {
    finalResponse: input.finalResponse,
    trajectoryId: input.trajectoryId,
    contextSummary,
    sourceRetrievalSummary: {
      requested: observation.sourceRequested,
      chunkCount: sourceChunks.length,
      chunkIds: sourceChunks.map((chunk) => chunk.id),
      materialIds: Array.from(new Set(sourceChunks.map((chunk) => chunk.materialId))),
      verified: sourceChunks.length > 0,
    },
    agentPlan: plan,
    toolCalls: state.calls.map((c) => ({ id: c.id, name: c.name, input: c.input, startedAt: c.startedAt })),
    toolResults: state.results,
    learningSignals,
    mutationSummary,
    verification,
    nextRecommendedAction: nextRecommendedActionFromMutations(mutationSummary),
  };
}
