import { SupabaseClient } from '@supabase/supabase-js';
import { LearningSignal, AgentToolContext } from '@/lib/agent/types';
import { resolvePracticeItemConcept, resolveConcept } from '@/lib/engines/concept-resolver';
import { generateMemoryCard } from '@/lib/memory/cardGenerator';
import { logger } from '@/lib/utils/logger';
import { stableKey } from '@/lib/agent/tools/learning/common';
import { CognitionError, toCognitionError } from '@/lib/errors/cognition-errors';
import { simulateMasteryUpdate } from '@/lib/engines/mastery-updater';
import { getUserLearningDate } from '@/lib/utils/local-date';

export interface ProjectionError {
  code: string;
  message: string;
}

export interface ProjectionResult {
  success: boolean;
  eventsWritten: number;
  masteryUpdated: boolean;
  cardsCreated: number;
  invalidationTriggered: boolean;
  mistakeRecorded: boolean;
  learningEventId: string | null;
  conceptId: string | null;
  masteryBefore: number | null;
  masteryAfter: number | null;
  revisionCardIds: string[];
  mistakeIds: string[];
  errors: ProjectionError[];
}

/**
 * Central deterministic projector for all learner-state changes.
 * Uses a single atomic Postgres RPC for strict integrity.
 */
export async function projectLearningSignal(
  supabase: SupabaseClient,
  userId: string,
  signal: LearningSignal,
  options: { goalId?: string | null; now?: Date; context?: AgentToolContext } = {}
): Promise<ProjectionResult> {
  const now = options.now || new Date();
  const goalId = options.goalId || (signal.metadata?.goalId as string | undefined) || null;
  
  const result: ProjectionResult = {
    success: true,
    eventsWritten: 0,
    masteryUpdated: false,
    cardsCreated: 0,
    invalidationTriggered: false,
    mistakeRecorded: false,
    learningEventId: null,
    conceptId: null,
    masteryBefore: null,
    masteryAfter: null,
    revisionCardIds: [],
    mistakeIds: [],
    errors: [],
  };

  const sessionId = signal.metadata?.sessionId as string | undefined;
  const assessmentId = signal.metadata?.assessmentId as string | undefined;

  const idempotencyKey = signal.metadata?.idempotencyKey as string | undefined 
    || stableKey(['proj', userId, signal.type, signal.concept || 'global', String(sessionId || assessmentId || now.toISOString())]);

  try {
    const localDate = await getUserLearningDate(userId, supabase, now);
    
    // 1. Initialize Payload
    const payload: any = {
      user_id: userId,
      goal_id: goalId,
      local_date: localDate,
      idempotency_key: idempotencyKey,
      learner_event: { type: signal.type, data: { ...signal, projected_at: now.toISOString() } },
      outbox: { type: signal.type, data: signal, metadata: { ...signal.metadata, idempotencyKey } },
      trace: { action: signal.type, trace_id: options.context?.runId },
    };

    let resolvedConceptId: string | null = null;
    let conceptName = (signal.canonicalConcept || signal.concept) as string;

    // 2. Strict Concept Resolution
    if (conceptName) {
      const resolution = signal.source === 'practice' 
        ? await resolvePracticeItemConcept({
            userId, goalId, subject: signal.subject, chapter: signal.chapter, conceptName,
            subtopic: signal.metadata?.subtopic as string, 
            microskill: signal.metadata?.microskill as string,
            client: supabase
          })
        : await resolveConcept({
            userId, goalId, subject: signal.subject || null, chapter: signal.chapter || null,
            topic: signal.topic || conceptName, sourceType: (signal.source as any) || 'chat',
            client: supabase
          });

      if (!resolution.conceptId && signal.source === 'practice') {
        throw new CognitionError('CONCEPT_RESOLUTION_REQUIRED', `Concept could not be resolved strictly for practice item ${conceptName}.`, true);
      } else if (!resolution.conceptId) {
        throw new CognitionError('CONCEPT_RESOLUTION_FAILED', `Concept could not be resolved for ${conceptName}.`, true);
      }
      
      resolvedConceptId = resolution.conceptId;
      result.conceptId = resolution.conceptId;

      // 3. Compute Mastery Delta (Dry-Run)
      let evidenceType: any = 'tutor_understood';
      if (signal.type === 'concept_understood' || (signal.type === 'concept_practiced' && signal.correct)) {
        evidenceType = 'practice_correct';
      } else if (signal.type === 'weak_area_detected' || signal.type === 'autopsy_mistake_detected' || (signal.type === 'concept_practiced' && !signal.correct)) {
        evidenceType = 'practice_wrong';
      } else if (signal.type === 'session_completed') {
        evidenceType = 'session_completed';
      } else if (signal.type === 'misconception_detected') {
        evidenceType = 'tutor_confused';
      }

      const sim = await simulateMasteryUpdate({
        userId, conceptId: resolvedConceptId, evidenceType, confidence: signal.confidence, client: supabase
      });
      
      payload.mastery = {
        concept_id: resolvedConceptId,
        old_mastery: sim.oldMastery,
        new_mastery: sim.newMastery,
        old_score: sim.oldScore,
        new_score: sim.newScore,
        delta: sim.delta,
        forgetting_probability: sim.forgettingProbability,
        confidence: sim.confidence,
        source: signal.source || 'agent',
        source_id: sessionId || assessmentId || idempotencyKey,
        evidence_type: evidenceType,
        evidence: signal.evidence || `Signal: ${signal.type}`,
        weight: sim.weight,
        event_confidence: signal.confidence || 1.0,
      };
      
      result.masteryUpdated = true;
      result.masteryBefore = sim.oldScore;
      result.masteryAfter = sim.newScore;
    }

    // 4. MEMORY Revision Cards
    const shouldCreateCard = ['weak_area_detected', 'misconception_detected', 'autopsy_mistake_detected', 'revision_needed'].includes(signal.type)
      || (signal.type === 'concept_practiced' && signal.correct === false);
      
    if (shouldCreateCard && resolvedConceptId) {
      const isMistakeSignal = ['weak_area_detected', 'misconception_detected', 'autopsy_mistake_detected'].includes(signal.type);
      const normalizedKey = isMistakeSignal 
        ? `mistake-repair:${stableKey([userId, conceptName, String(signal.metadata?.questionId || signal.evidence || '')])}`
        : `proj-mem:${userId}:${signal.type}:${stableKey([conceptName, String(sessionId || assessmentId || '')])}`;
      
      const generated = generateMemoryCard(signal as any);
      payload.revision_cards = [{
        concept_id: resolvedConceptId,
        front: generated.front,
        back: generated.back,
        subject: signal.subject || 'General',
        chapter: signal.chapter || signal.topic || 'General',
        source_type: isMistakeSignal ? 'mistake' : signal.type,
        source_id: String(sessionId || assessmentId || idempotencyKey),
        card_type: isMistakeSignal ? 'mistake_repair' : 'autopsy_recovery',
        normalized_key: normalizedKey,
        metadata: { ...signal.metadata, signalType: signal.type },
      }];
      result.cardsCreated++;
    }

    // 5. Autopsy & Mistakes
    const isMistake = ['autopsy_mistake_detected', 'weak_area_detected', 'misconception_detected'].includes(signal.type);
    if (isMistake && resolvedConceptId) {
      payload.mistakes = [{
        concept_id: resolvedConceptId,
        subject: signal.subject || null,
        topic: signal.topic || conceptName || null,
        mistake_text: (signal.metadata?.mistakeText as string) || signal.evidence || 'Mistake evidence was not provided.',
        question_text: (signal.metadata?.questionText as string) || null,
        correct_answer: (signal.metadata?.correctAnswer as string) || null,
        user_answer: (signal.metadata?.userAnswer as string) || null,
        why_wrong: (signal.metadata?.whyWrong as string) || null,
        severity: (signal.metadata?.severity as number) || (signal.type === 'misconception_detected' ? 4 : 3),
        source: signal.source || 'autopsy',
        source_id: String(sessionId || assessmentId || idempotencyKey),
        metadata: { ...signal.metadata, idempotencyKey },
      }];
      result.mistakeRecorded = true;
    }

    // 6. Session Card Invalidation
    if (signal.type === 'session_completed') {
      payload.session_card = { action: 'complete_today' };
      result.invalidationTriggered = true;
    } else if (signal.type === 'autopsy_mistake_detected' || signal.type === 'concept_practiced') {
      payload.session_card = { action: 'invalidate_today' };
      result.invalidationTriggered = true;
    }

    // 7. Atomic RPC Execution
    const { data: rpcResult, error: rpcError } = await supabase.rpc('apply_core_loop_projection', { payload });
    
    if (rpcError) {
      throw new CognitionError('CORE_LOOP_PROJECTION_FAILED', `RPC failed: ${rpcError.message}`, true, undefined, rpcError);
    }
    if (!rpcResult?.ok) {
      throw new CognitionError('CORE_LOOP_PROJECTION_REJECTED', `RPC rejected: ${rpcResult?.message}`, true, undefined, rpcResult);
    }

    result.learningEventId = rpcResult.learning_event_id || idempotencyKey;
    if (rpcResult.revision_card_ids) result.revisionCardIds = rpcResult.revision_card_ids;
    if (rpcResult.mistake_ids) result.mistakeIds = rpcResult.mistake_ids;
    result.eventsWritten = 1;
    
  } catch (err: any) {
    const cognitionError = toCognitionError(err, 'LEARNING_EVENT_FAILED', 'Learner state projection failed.');
    logger.error('Projector: fatal error projecting signal', { 
      userId, 
      signalType: signal.type, 
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      details: err 
    });
    result.success = false;
    result.errors.push({ code: cognitionError.code, message: cognitionError.message });
  }

  return result;
}
