import { SupabaseClient } from '@supabase/supabase-js';
import { LearningSignal, AgentToolContext } from '@/lib/agent/types';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { createRevisionCardsForUser } from '@/lib/amaura/agents/repositories';
import { generateMemoryCard } from '@/lib/memory/cardGenerator';
import { invalidateSessionCard, markSessionCardCompleted } from '@/lib/services/session-card-invalidation';
import { logger } from '@/lib/utils/logger';
import { stableKey, recordAgentActivity } from '@/lib/agent/tools/learning/common';
import { upsertMistakeRisk } from '@/lib/services/repair-loop.service';
import { CognitionError, toCognitionError } from '@/lib/errors/cognition-errors';

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
 * Ensures idempotency via signal metadata and stable keys.
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
    // 1. Write learning_event (Deterministic log)
    const { error: eventError } = await supabase.from('learner_events').upsert({
      user_id: userId,
      event_type: signal.type,
      event_data: {
        ...signal,
        projected_at: now.toISOString(),
      },
      idempotency_key: idempotencyKey,
      updated_at: now.toISOString(),
    }, { onConflict: 'idempotency_key' });

    if (eventError) {
      throw new CognitionError('EVENT_WRITE_FAILED', `Learning event could not be written: ${eventError.message}`, true);
    }
    result.eventsWritten++;
    result.learningEventId = idempotencyKey;

    // 2. Profile Streak / Activity
    if (signal.type === 'session_completed' || signal.type === 'concept_practiced' || signal.type === 'revision_reviewed') {
      const { error: profileError } = await supabase.from('profiles').update({
        last_active_at: now.toISOString(),
        updated_at: now.toISOString(),
      }).eq('id', userId);
      if (profileError) {
        throw new CognitionError('SESSION_UPDATE_FAILED', `Learner activity could not be updated: ${profileError.message}`, true);
      }
    }

    // 3. ATLAS Concept Mastery
    let resolvedConceptId: string | null = null;
    if (signal.concept || signal.canonicalConcept) {
      const conceptName = (signal.canonicalConcept || signal.concept) as string;
      
      const resolution = await resolveConcept({
        userId,
        goalId,
        subject: signal.subject || null,
        chapter: signal.chapter || null,
        topic: signal.topic || conceptName,
        sourceType: (signal.source === 'source' ? 'chat' : signal.source) || 'chat',
        client: supabase,
      });

      if (resolution.conceptId) {
        resolvedConceptId = resolution.conceptId;
        result.conceptId = resolution.conceptId;
        // Map signal type to mastery evidence type
        let evidenceType: 'practice_correct' | 'practice_wrong' | 'tutor_understood' | 'tutor_confused' | 'session_completed' = 'tutor_understood';
        
        if (signal.type === 'concept_understood' || (signal.type === 'concept_practiced' && signal.correct)) {
          evidenceType = 'practice_correct';
        } else if (signal.type === 'weak_area_detected' || signal.type === 'autopsy_mistake_detected' || (signal.type === 'concept_practiced' && !signal.correct)) {
          evidenceType = 'practice_wrong';
        } else if (signal.type === 'session_completed') {
          evidenceType = 'session_completed';
        } else if (signal.type === 'misconception_detected') {
          evidenceType = 'tutor_confused';
        }

        try {
          const masteryRes = await recordMasteryEvidence({
            userId,
            conceptId: resolution.conceptId,
            evidenceType,
            source: (signal.source as any) || 'agent',
            sourceId: String(sessionId || assessmentId || idempotencyKey),
            evidence: signal.evidence || `Signal: ${signal.type}`,
            confidence: signal.confidence,
            client: supabase,
          });
          result.masteryUpdated = true;
          result.masteryBefore = masteryRes.oldScore ?? null;
          result.masteryAfter = masteryRes.newScore ?? null;

          if (options.context && masteryRes.changed) {
            await recordAgentActivity(supabase, {
              userId,
              runId: options.context.runId,
              agentName: 'atlas',
              actionType: 'atlas_mastery_updated',
              targetType: 'concept',
              targetId: resolution.conceptId,
              confidence: signal.confidence,
              evidence: { signal, masteryRes },
              reason: `Mastery updated for ${conceptName} based on ${signal.type}`,
              idempotencyKey: stableKey([idempotencyKey, 'mastery-act']),
            });

            // Hermes v1 Audit Trail
            await supabase.from('learning_state_changes').insert({
              user_id: userId,
              run_id: options.context.runId,
              tool_name: 'projectLearningSignal',
              event_type: 'atlas_mastery_updated',
              concept_id: resolution.conceptId,
              before_state: { mastery: masteryRes.oldMastery, score: masteryRes.oldScore },
              after_state: { mastery: masteryRes.newMastery, score: masteryRes.newScore },
              diff_summary: { delta: masteryRes.delta, signal: signal.type, reason: `Mastery updated for ${conceptName}` },
              policy_decision: 'auto_approved_by_projector',
            });
          }
        } catch (masteryErr) {
          throw new CognitionError(
            'MASTERY_UPDATE_FAILED',
            masteryErr instanceof Error ? masteryErr.message : 'Concept mastery could not be updated.',
            true,
            undefined,
            masteryErr
          );
        }
      } else {
        throw new CognitionError('CONCEPT_RESOLUTION_FAILED', `Concept could not be resolved for ${conceptName}.`, true);
      }
    }

    // 4. MEMORY Revision Cards
    const shouldCreateCard = ['weak_area_detected', 'misconception_detected', 'autopsy_mistake_detected', 'revision_needed'].includes(signal.type)
      || (signal.type === 'concept_practiced' && signal.correct === false);
    if (shouldCreateCard && signal.concept) {
      if (!resolvedConceptId) {
        throw new CognitionError('CONCEPT_RESOLUTION_FAILED', 'A revision card requires a resolved concept.', true);
      }
      try {
        const isMistakeSignal = ['weak_area_detected', 'misconception_detected', 'autopsy_mistake_detected'].includes(signal.type);
        const normalizedKey = isMistakeSignal 
          ? `mistake-repair:${stableKey([userId, signal.concept, String(signal.metadata?.questionId || signal.evidence || '')])}`
          : `proj-mem:${userId}:${signal.type}:${stableKey([signal.concept, String(sessionId || assessmentId || '')])}`;
        
        const generated = generateMemoryCard(signal as any);
        const [card] = await createRevisionCardsForUser(userId, [{
          goalId,
          conceptId: resolvedConceptId,
          front: generated.front,
          back: generated.back,
          subject: signal.subject || 'General',
          chapter: signal.chapter || signal.topic || 'General',
          sourceType: isMistakeSignal ? 'mistake' : signal.type,
          sourceId: String(sessionId || assessmentId || idempotencyKey),
          origin: 'chat',
          cardType: isMistakeSignal ? 'mistake_repair' : 'autopsy_recovery',
          normalizedKey,
          metadata: { ...signal.metadata, signalType: signal.type },
        }], { client: supabase });

        if (card) {
          result.cardsCreated++;
          result.revisionCardIds.push(card.id);
          if (options.context) {
            await recordAgentActivity(supabase, {
              userId,
              runId: options.context.runId,
              agentName: 'memory',
              actionType: 'memory_card_created',
              targetType: 'revision_card',
              targetId: card.id,
              confidence: signal.confidence,
              evidence: { signal, cardId: card.id },
              reason: `Revision card created for ${signal.concept} based on ${signal.type}`,
              idempotencyKey: stableKey([idempotencyKey, 'card-act']),
            });

            // Hermes v1 Audit Trail
            await supabase.from('learning_state_changes').insert({
              user_id: userId,
              run_id: options.context.runId,
              tool_name: 'projectLearningSignal',
              event_type: 'memory_card_created',
              before_state: null,
              after_state: { card_id: card.id, front: generated.front, back: generated.back },
              diff_summary: { signal: signal.type, reason: `Revision card created for ${signal.concept}` },
              policy_decision: 'auto_approved_by_projector',
            });
          }
        }
      } catch (cardErr) {
        throw new CognitionError(
          'MEMORY_UPDATE_FAILED',
          cardErr instanceof Error ? cardErr.message : 'Revision memory could not be updated.',
          true,
          undefined,
          cardErr
        );
      }
    }

    // 5. Autopsy & Practice Mistakes (via Repair Loop)
    const questionId = signal.metadata?.questionId as string | undefined;
    const isMistake = ['autopsy_mistake_detected', 'weak_area_detected', 'misconception_detected'].includes(signal.type);
    
    if (isMistake) {
      try {
        const mistakeRes = await upsertMistakeRisk(supabase, {
          userId,
          goalId,
          source: (signal.source as any) || 'autopsy',
          subject: signal.subject || null,
          topic: signal.topic || signal.concept || null,
          concept: signal.concept || null,
          conceptId: resolvedConceptId || (signal.metadata?.conceptId as string) || null,
          mistakeText: (signal.metadata?.mistakeText as string) || signal.evidence || 'Mistake evidence was not provided.',
          questionText: (signal.metadata?.questionText as string) || null,
          correctAnswer: (signal.metadata?.correctAnswer as string) || null,
          userAnswer: (signal.metadata?.userAnswer as string) || null,
          whyWrong: (signal.metadata?.whyWrong as string) || null,
          severity: (signal.metadata?.severity as number) || (signal.type === 'misconception_detected' ? 4 : 3),
          sourceId: String(sessionId || assessmentId || idempotencyKey),
          invalidateSession: false, // We handle invalidation separately in step 6
          metadata: { ...signal.metadata, idempotencyKey },
        });

        if (mistakeRes.mistake) {
          result.mistakeRecorded = true;
          result.mistakeIds.push(mistakeRes.mistake.id);
          if (options.context) {
            await recordAgentActivity(supabase, {
              userId,
              runId: options.context.runId,
              agentName: 'autopsy',
              actionType: 'mistake_recorded',
              targetType: 'mistake',
              targetId: mistakeRes.mistake.id,
              confidence: signal.confidence,
              evidence: { signal, mistakeId: mistakeRes.mistake.id },
              reason: `Mistake recorded for ${signal.concept} based on ${signal.type}`,
              idempotencyKey: stableKey([idempotencyKey, 'mistake-act']),
            });

            // Hermes v1 Audit Trail
            await supabase.from('learning_state_changes').insert({
              user_id: userId,
              run_id: options.context.runId,
              tool_name: 'projectLearningSignal',
              event_type: 'mistake_recorded',
              concept_id: mistakeRes.mistake.concept_id || null,
              before_state: null,
              after_state: { mistake_id: mistakeRes.mistake.id, mistake_text: mistakeRes.mistake.mistake_text },
              diff_summary: { signal: signal.type, severity: mistakeRes.mistake.severity, reason: `Mistake recorded for ${signal.concept}` },
              policy_decision: 'auto_approved_by_projector',
            });
          }
        }
      } catch (mistakeErr) {
        throw new CognitionError(
          'MISTAKE_WRITE_FAILED',
          mistakeErr instanceof Error ? mistakeErr.message : 'Mistake state could not be updated.',
          true,
          undefined,
          mistakeErr
        );
      }
    }

    // 6. Session Card Invalidation (Phase 5.5: complete not invalidate today)
    const shouldAct = ['session_completed', 'autopsy_mistake_detected', 'concept_practiced'].includes(signal.type);
    if (shouldAct) {
      try {
        const localDate = now.toISOString().split('T')[0];
        if (signal.type === 'session_completed') {
          // Mark today's card as completed (preserves history), then invalidate only tomorrow
          await markSessionCardCompleted(userId, localDate, goalId, { client: supabase });
          // Only delete tomorrow's card so future recommendations adapt
          const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
          let tomorrowDelete = supabase.from('session_cards').delete().eq('user_id', userId).eq('date', tomorrow);
          if (goalId) {
            tomorrowDelete = tomorrowDelete.eq('goal_id', goalId);
          } else {
            tomorrowDelete = tomorrowDelete.is('goal_id', null);
          }
          await tomorrowDelete;
          result.invalidationTriggered = true;
        } else if (signal.type === 'autopsy_mistake_detected') {
          // For autopsy: only invalidate today if card is NOT already completed
          let todayCardQuery = supabase
            .from('session_cards')
            .select('is_completed, isCompleted')
            .eq('user_id', userId)
            .eq('date', localDate);
          if (goalId) {
            todayCardQuery = todayCardQuery.eq('goal_id', goalId);
          } else {
            todayCardQuery = todayCardQuery.is('goal_id', null);
          }
          const { data: todayCard } = await todayCardQuery.maybeSingle();
          const isAlreadyCompleted = todayCard?.is_completed || todayCard?.isCompleted;
          if (!isAlreadyCompleted) {
            await invalidateSessionCard(userId, 'AUTOPSY_COMPLETED' as any, {
              goalId,
              sourceEventId: idempotencyKey,
              client: supabase,
            });
          } else {
            // Card done — only invalidate tomorrow
            const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
            let tomorrowDelete = supabase.from('session_cards').delete().eq('user_id', userId).eq('date', tomorrow);
            if (goalId) {
              tomorrowDelete = tomorrowDelete.eq('goal_id', goalId);
            } else {
              tomorrowDelete = tomorrowDelete.is('goal_id', null);
            }
            await tomorrowDelete;
          }
          result.invalidationTriggered = true;
        } else {
          // concept_practiced — invalidate normally
          await invalidateSessionCard(userId, 'STUDY_SESSION_COMPLETED' as any, {
            goalId,
            sourceEventId: idempotencyKey,
            client: supabase,
          });
          result.invalidationTriggered = true;
        }
      } catch (invErr) {
        throw new CognitionError(
          'SESSION_UPDATE_FAILED',
          invErr instanceof Error ? invErr.message : 'Session state could not be updated.',
          true,
          undefined,
          invErr
        );
      }
    }

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
