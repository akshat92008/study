import { createClient } from '@/lib/supabase/server';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { logger } from '@/lib/utils/logger';
import { projectLearningSignal } from '@/lib/learner-state/projector';
import type { LearningSignal, AgentChannel } from '@/lib/agent/types';

/**
 * Deterministically completes a study session.
 * Updates streak, mastery, revision cards, and invalidates session-card via central projector.
 */
export async function completeLearningSession(input: {
  userId: string;
  sessionId?: string | null;
  taskId?: string | null;
  goalId?: string | null;
  subject?: string | null;
  chapter?: string | null;
  conceptName?: string | null;
  durationMinutes: number;
  understood: boolean;
  gapFound?: boolean | null;
  cardsCreated?: number;
  source?: AgentChannel | 'source';
  idempotencyKey?: string | null;
  client?: any;
}) {
  const supabase = input.client || await createClient();
  const sessionId = input.sessionId || input.taskId;
  
  const durationMinutes = input.durationMinutes;
  const understood = input.understood;
  const completionKey = input.idempotencyKey || `session_complete:${input.userId}:${sessionId || Date.now()}`;

  // 1. Fetch session context if not provided
  let subject = input.subject;
  let chapter = input.chapter;
  let conceptName = input.conceptName;
  let conceptId = null;

  if (sessionId && (!subject || !chapter || !conceptName)) {
    const { data: session, error: sessionErr } = await supabase
      .from('study_sessions')
      .select('id, subject, chapter, concept_name, concept_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (!sessionErr && session) {
      subject = subject || session.subject;
      chapter = chapter || session.chapter;
      conceptName = conceptName || session.concept_name;
      conceptId = session.concept_id;
    }
  }

  if (!subject || !chapter) {
    throw new Error('Subject and Chapter are required if no valid Session ID is provided');
  }

  // 2. Atomic RPC for session record completion & streak update
  const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_study_session', {
    p_user_id: input.userId,
    p_subject: subject || 'General',
    p_chapter: chapter || 'General',
    p_topic: conceptName || 'General',
    p_concept_name: conceptName || 'General',
    p_duration_minutes: durationMinutes,
    p_understood: understood,
    p_gap_found: input.gapFound ? String(input.gapFound) : null,
    p_cards_created: input.cardsCreated || 0,
    p_session_type: 'study',
    p_task_id: input.taskId && /^[0-9a-f-]{36}$/i.test(input.taskId) ? input.taskId : null,
    p_concept_id: conceptId && /^[0-9a-f-]{36}$/i.test(conceptId) ? conceptId : null,
    p_completion_key: completionKey,
    p_source: input.source || 'session',
  });

  if (rpcError) {
    logger.error('Failed to complete study session via RPC', { sessionId, error: rpcError });
    throw rpcError;
  }

  const finalSessionId = rpcResult.session_id || sessionId;

  // 3. Centralized Projection (Fix: Unified Path)
  const sessionSignal: LearningSignal = {
    type: 'session_completed',
    concept: conceptName || 'General Session',
    canonicalConcept: conceptName || 'General Session',
    subject: subject || 'General',
    chapter: chapter || 'General',
    topic: conceptName || 'General',
    confidence: 1.0,
    source: input.source || 'session',
    evidence: `Completed session on ${subject} / ${chapter} for ${durationMinutes} mins.`,
    metadata: {
      userId: input.userId,
      sessionId: finalSessionId,
      subject,
      chapter,
      conceptName,
      conceptId,
      durationMinutes,
      understood,
      gapFound: input.gapFound ?? null,
      idempotencyKey: completionKey,
    },
  };

  const projection = await projectLearningSignal(supabase, input.userId, sessionSignal, {
    goalId: input.goalId,
  });

  // Normalize streak: SQL currently returns streak_days, old SQL returned new_streak.
  // Always read streak_days first to match the DB column name.
  const normalizedStreak = rpcResult.streak_days ?? rpcResult.new_streak ?? 0;

  return {
    success: true,
    streakChanged: rpcResult.streak_changed ?? false,
    newStreak: normalizedStreak,
    streakDays: normalizedStreak,
    sessionId: finalSessionId,
    conceptId,
    subject,
    chapter,
    understood,
    cardsCreated: projection.cardsCreated || input.cardsCreated || 0,
    projection,
  };
}

async function markCachedSessionCardCompleted(
  supabase: any,
  input: { userId: string; goalId?: string | null }
) {
  // This is now handled by projectLearningSignal -> invalidateSessionCard
  return { success: true };
}
