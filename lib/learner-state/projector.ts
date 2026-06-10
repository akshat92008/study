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

export interface ProjectionResult {
  success: boolean;
  eventsWritten: number;
  masteryUpdated: boolean;
  cardsCreated: number;
  invalidationTriggered: boolean;
  mistakeRecorded: boolean;
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

    if (!eventError) result.eventsWritten++;

    // 2. Profile Streak / Activity
    if (signal.type === 'session_completed' || signal.type === 'concept_practiced' || signal.type === 'revision_reviewed') {
      await supabase.from('profiles').update({
        last_active_at: now.toISOString(),
        updated_at: now.toISOString(),
      }).eq('id', userId);
    }

    // 3. ATLAS Concept Mastery
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
          }
        } catch (masteryErr) {
          logger.warn('Projector: failed to update mastery', { userId, signalType: signal.type, error: masteryErr });
        }
      }
    }

    // 4. MEMORY Revision Cards
    const shouldCreateCard = ['weak_area_detected', 'misconception_detected', 'autopsy_mistake_detected', 'session_completed', 'concept_practiced'].includes(signal.type);
    if (shouldCreateCard && signal.concept) {
      try {
        const isMistakeSignal = ['weak_area_detected', 'misconception_detected', 'autopsy_mistake_detected'].includes(signal.type);
        const normalizedKey = isMistakeSignal 
          ? `mistake-repair:${stableKey([userId, signal.concept, String(signal.metadata?.questionId || signal.evidence || '')])}`
          : `proj-mem:${userId}:${signal.type}:${stableKey([signal.concept, String(sessionId || assessmentId || '')])}`;
        
        const generated = generateMemoryCard(signal as any);
        const [card] = await createRevisionCardsForUser(userId, [{
          goalId,
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
          }
        }
      } catch (cardErr) {
        logger.warn('Projector: failed to create revision card', { userId, signalType: signal.type, error: cardErr });
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
          conceptId: (signal.metadata?.conceptId as string) || null,
          mistakeText: (signal.metadata?.mistakeText as string) || signal.evidence || 'Unknown mistake',
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
          }
        }
      } catch (mistakeErr) {
        logger.warn('Projector: failed to upsert mistake risk', { userId, signalType: signal.type, error: mistakeErr });
      }
    }

    // 6. Session Card Invalidation (Phase 5.5: complete not invalidate today)
    const shouldAct = ['session_completed', 'autopsy_mistake_detected', 'concept_practiced'].includes(signal.type);
    if (shouldAct) {
      try {
        const localDate = now.toISOString().split('T')[0];
        if (signal.type === 'session_completed') {
          // Mark today's card as completed (preserves history), then invalidate only tomorrow
          await markSessionCardCompleted(userId, localDate, { client: supabase });
          // Only delete tomorrow's card so future recommendations adapt
          const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
          let tomorrowDelete = (supabase as any).from('session_cards').delete().eq('user_id', userId).eq('date', tomorrow);
          if (goalId) tomorrowDelete = tomorrowDelete.eq('goal_id', goalId);
          await tomorrowDelete;
          result.invalidationTriggered = true;
        } else if (signal.type === 'autopsy_mistake_detected') {
          // For autopsy: only invalidate today if card is NOT already completed
          const { data: todayCard } = await (supabase as any)
            .from('session_cards')
            .select('is_completed, isCompleted')
            .eq('user_id', userId)
            .eq('date', localDate)
            .maybeSingle();
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
            let tomorrowDelete = (supabase as any).from('session_cards').delete().eq('user_id', userId).eq('date', tomorrow);
            if (goalId) tomorrowDelete = tomorrowDelete.eq('goal_id', goalId);
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
        logger.warn('Projector: failed to invalidate/complete session card', { userId, signalType: signal.type, error: invErr });
      }
    }

  } catch (err: any) {
    logger.error('Projector: fatal error projecting signal', { 
      userId, 
      signalType: signal.type, 
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      details: err 
    });
    result.success = false;
  }

  return result;
}
