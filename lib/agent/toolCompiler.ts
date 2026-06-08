import type { AgentObservation, AgentToolContext, LearningSignal, RetrievedSourceChunk } from './types';
import { logger } from '@/lib/utils/logger';

/** Normalize a concept name to a canonical lookup key */
function conceptKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface RuntimeState {
  conceptsByName: Map<string, string>;
  latestSignals: LearningSignal[];
  sourceChunks: RetrievedSourceChunk[];
  cardIds: string[];
  toolResults: any[];
  /** Fix 7: Track executed call keys to prevent duplicate context/extraction calls */
  executedCallKeys: Set<string>;
}

export interface CompileToolPlanInput {
  plannedTools: Array<{ name: string; input: any }>;
  runtimeState: RuntimeState;
  context: AgentToolContext;
  observation: AgentObservation;
  finalResponse?: string;
}

export function compileToolPlan(input: CompileToolPlanInput): Array<{ name: string; args: any }> {
  const { plannedTools, runtimeState, context, observation, finalResponse } = input;
  const compiledTools: Array<{ name: string; args: any }> = [];

  for (const planned of plannedTools) {
    const { name, input: plannedInput } = planned;

    // Handle semantic placeholders or incomplete inputs
    if (name === 'extract_learning_signals') {
      compiledTools.push({
        name,
        args: {
          userMessage: observation.userMessage,
          assistantMessage: finalResponse ?? '',
          channel: observation.channel,
          payload: observation.payload,
          retrievedChunks: runtimeState.sourceChunks,
          contextSummary: context.contextSummary ?? {},
        },
      });
      continue;
    }

    if (name === 'upsert_atlas_concept' && plannedInput.from === 'signals') {
      for (const signal of runtimeState.latestSignals) {
        const conceptName = signal.canonicalConcept ?? signal.concept;
        if (conceptName) {
          compiledTools.push({
            name,
            args: {
              concept: conceptName,
              subject: signal.subject ?? null,
              chapter: signal.chapter ?? null,
              topic: signal.topic ?? conceptName,
              goalId: context.goalId,
            },
          });
        }
      }
      continue;
    }

    if (name === 'update_concept_mastery') {
      // Fix 4 & Fix 8: Use normalized concept key; only compile when conceptId is known
      for (const signal of runtimeState.latestSignals) {
        const conceptName = signal.canonicalConcept ?? signal.concept;
        const key = conceptName ? conceptKey(conceptName) : null;
        if (key && runtimeState.conceptsByName.has(key)) {
          const conceptId = runtimeState.conceptsByName.get(key)!;
          compiledTools.push({
            name,
            args: {
              conceptId,
              signal,
              evidenceRef: `${context.runId ?? 'unknown'}:${conceptId}:${signal.type}`,
            },
          });
        }
      }
      continue;
    }

    if (name === 'create_memory_card') {
      // Fix 4 & Fix 8: Use normalized concept key; only compile when conceptId is known
      const validSignals = ['weak_area_detected', 'misconception_detected', 'revision_needed', 'practice_needed', 'session_completed'];
      for (const signal of runtimeState.latestSignals) {
        if (!validSignals.includes(signal.type)) continue;

        const conceptName = signal.canonicalConcept ?? signal.concept;
        const key = conceptName ? conceptKey(conceptName) : null;
        if (key && runtimeState.conceptsByName.has(key)) {
          compiledTools.push({
            name,
            args: {
              conceptId: runtimeState.conceptsByName.get(key)!,
              signal,
              sourceMaterialId: runtimeState.sourceChunks[0]?.materialId ?? null,
              goalId: context.goalId,
            },
          });
        }
      }
      continue;
    }

    if (name === 'update_microtarget') {
      // Fix 4 & Fix 8: Use normalized concept key; compile with null-safe conceptId
      for (const signal of runtimeState.latestSignals) {
        const conceptName = signal.canonicalConcept ?? signal.concept;
        const key = conceptName ? conceptKey(conceptName) : null;
        const conceptId = key ? runtimeState.conceptsByName.get(key) ?? null : null;
        compiledTools.push({
          name,
          args: {
            eventType: signal.type,
            conceptId,
            concept: conceptName ?? null,
            subject: signal.subject ?? null,
            topic: signal.topic ?? conceptName ?? null,
            goalId: context.goalId,
          },
        });
      }
      continue;
    }

    if (name === 'write_learning_event') {
      // Fix 4 & Fix 8: Use normalized concept key
      for (const signal of runtimeState.latestSignals) {
        const conceptName = signal.canonicalConcept ?? signal.concept;
        const key = conceptName ? conceptKey(conceptName) : null;
        const conceptId = key ? runtimeState.conceptsByName.get(key) ?? null : null;
        compiledTools.push({
          name,
          args: {
            eventType: signal.type,
            payload: {
              concept: conceptName,
              conceptId: conceptId,
              evidence: signal.evidence,
              confidence: signal.confidence,
              runId: context.runId,
            },
            goalId: context.goalId,
          },
        });
      }
      continue;
    }

    // Fix 7: Session double-completion prevention
    if (name === 'complete_session') {
      const alreadyCompleted = (observation.payload as any)?.alreadyCompleted === true;
      if (alreadyCompleted) {
        logger.info('Skipping complete_session tool as session is already marked completed');
        continue;
      }
    }

    // Fix 9: Autopsy double-mutation prevention
    if (name === 'record_autopsy_mistake') {
      const alreadyProjected = (observation.payload as any)?.alreadyProjected === true;
      if (alreadyProjected) {
        logger.info('Skipping record_autopsy_mistake tool as autopsy is already projected');
        continue;
      }
    }

    // Fix 12: Block ATLAS/MEMORY mutations when autopsy already projected
    if ((observation.payload as any)?.alreadyProjected === true && observation.channel === 'autopsy') {
      const blockedTools = ['upsert_atlas_concept', 'update_concept_mastery', 'create_memory_card'];
      if (blockedTools.includes(name)) {
        logger.info(`Skipping ${name} as autopsy is already projected and mutation would duplicate ATLAS/MEMORY`);
        continue;
      }
    }

    // Fallback: use planned input if no specific compilation rule
    compiledTools.push({ name, args: plannedInput });
  }

  return compiledTools;
}
