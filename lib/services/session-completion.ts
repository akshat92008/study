import { createClient } from '@/lib/supabase/server';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { logger } from '@/lib/utils/logger';

export interface CompleteLearningSessionInput {
  userId: string;
  taskId?: string | null;
  subject?: string | null;
  chapter?: string | null;
  conceptName?: string | null;
  durationMinutes?: number | null;
  understood?: boolean | null;
  gapFound?: string | null;
  cardsCreated?: number | null;
  sessionType?: string | null;
  goalId?: string | null;
  idempotencyKey?: string | null;
  source?: 'complete_session' | 'session_close' | 'chat' | 'system';
  client?: any;
}

export interface CompleteLearningSessionResult {
  sessionId: string;
  conceptId: string | null;
  streakDays: number;
  streakChanged: boolean;
  subject: string;
  chapter: string;
  understood: boolean;
  cardsCreated: number;
}

function getLocalDate(timezone?: string | null): string {
  try {
    if (timezone) {
      return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    }
  } catch {
    // Fall back to server date below.
  }
  return new Date().toISOString().slice(0, 10);
}

async function markCachedSessionCardCompleted(
  supabase: any,
  input: { userId: string; goalId?: string | null }
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, learner_state_version, timezone')
    .eq('id', input.userId)
    .maybeSingle();

  const localDate = getLocalDate(profile?.timezone ?? null);
  const update: Record<string, unknown> = {
    isCompleted: true,
    completedAt: new Date().toISOString(),
    is_completed: true,
    completed_at: new Date().toISOString(),
  };
  if (typeof profile?.learner_state_version === 'number') {
    update.learner_state_version = profile.learner_state_version;
  }

  let query = supabase
    .from('session_cards')
    .update(update)
    .eq('user_id', input.userId)
    .eq('date', localDate);

  if (input.goalId) query = query.eq('goal_id', input.goalId);
  await query;

  return {
    streakDays: Number(profile?.streak_days ?? 0),
  };
}

async function recordSessionMasteryIfMissing(
  supabase: any,
  input: {
    userId: string;
    conceptId: string | null;
    sessionId: string;
    understood: boolean;
    subject: string;
    chapter: string;
  }
) {
  if (!input.conceptId) return;

  const { data: existing } = await supabase
    .from('mastery_events')
    .select('id')
    .eq('user_id', input.userId)
    .eq('concept_id', input.conceptId)
    .eq('source_id', input.sessionId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return;

  await recordMasteryEvidence({
    userId: input.userId,
    conceptId: input.conceptId,
    evidenceType: input.understood ? 'session_completed' : 'tutor_confused',
    source: 'session_close',
    sourceId: input.sessionId,
    idempotencyKey: `session_mastery:${input.userId}:${input.sessionId}:${input.conceptId}`,
    evidence: input.understood
      ? `Completed a study session on ${input.subject} / ${input.chapter}.`
      : `Completed a study session and flagged a gap in ${input.subject} / ${input.chapter}.`,
    confidence: input.understood ? 0.65 : 0.76,
    client: supabase,
  }).catch((error) => {
    logger.warn('Session mastery evidence write skipped', {
      userId: input.userId,
      sessionId: input.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function completeLearningSession(
  input: CompleteLearningSessionInput
): Promise<CompleteLearningSessionResult> {
  const startedAt = Date.now();
  const supabase = input.client ?? (await createClient());
  const source = input.source ?? 'complete_session';
  const subject = (input.subject || 'General').trim() || 'General';
  const chapter = (input.chapter || input.conceptName || 'Session').trim() || 'Session';
  const conceptName = (input.conceptName || chapter).trim();
  const durationMinutes = Math.max(1, Number(input.durationMinutes || 25));
  const understood = input.understood ?? true;
  const cardsCreated = Number(input.cardsCreated || 0);
  const completionKey = input.idempotencyKey || (input.taskId ? `${source}:task:${input.taskId}` : null);

  if (completionKey) {
    const { data: existing } = await supabase
      .from('study_sessions')
      .select('id, subject, chapter, metadata')
      .eq('user_id', input.userId)
      .eq('metadata->>completion_key', completionKey)
      .maybeSingle();

    if (existing?.id) {
      logger.info('Session completion idempotency hit', {
        userId: input.userId,
        feature: 'session-completion',
        sessionId: existing.id,
      });
      const { data: profile } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('id', input.userId)
        .maybeSingle();
      await markCachedSessionCardCompleted(supabase, {
        userId: input.userId,
        goalId: input.goalId ?? null,
      }).catch(() => undefined);

      return {
        sessionId: existing.id,
        conceptId: existing.metadata?.conceptId ?? null,
        streakDays: Number(profile?.streak_days ?? 0),
        streakChanged: false,
        subject: existing.subject || subject,
        chapter: existing.chapter || chapter,
        understood,
        cardsCreated,
      };
    }
  }

  const resolution = await resolveConcept({
    userId: input.userId,
    subject,
    chapter,
    topic: conceptName,
    sourceType: 'session',
    confidence: 0.94,
    client: supabase,
  });
  const conceptId = resolution.conceptId;
  
  const { data: rpcResult, error: sessionError } = await supabase.rpc('complete_study_session', {
    p_user_id: input.userId,
    p_subject: subject,
    p_chapter: chapter,
    p_topic: conceptName,
    p_concept_name: conceptName,
    p_duration_minutes: durationMinutes,
    p_understood: understood,
    p_gap_found: input.gapFound ?? null,
    p_cards_created: cardsCreated,
    p_session_type: input.sessionType || 'study',
    p_task_id: input.taskId ?? null,
    p_concept_id: conceptId,
    p_completion_key: completionKey,
    p_source: source
  });

  if (sessionError || !rpcResult?.session_id) {
    // If it's a unique constraint violation on the completion key, handle it as idempotency hit due to a race condition
    if (sessionError?.code === '23505' && completionKey) {
      logger.info('Session completion idempotency hit via race condition constraint', {
        userId: input.userId,
        feature: 'session-completion',
      });
      const { data: existing } = await supabase
        .from('study_sessions')
        .select('id, subject, chapter, metadata')
        .eq('user_id', input.userId)
        .eq('metadata->>completion_key', completionKey)
        .maybeSingle();

      if (existing?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('streak_days')
          .eq('id', input.userId)
          .maybeSingle();

        return {
          sessionId: existing.id,
          conceptId: existing.metadata?.conceptId ?? null,
          streakDays: Number(profile?.streak_days ?? 0),
          streakChanged: false,
          subject: existing.subject || subject,
          chapter: existing.chapter || chapter,
          understood,
          cardsCreated,
        };
      }
    }

    logger.error('Session completion RPC failed', sessionError, {
      userId: input.userId,
      feature: 'session-completion',
    });
    throw new Error(sessionError?.message || 'Failed to save study session via RPC');
  }

  const sessionId = rpcResult.session_id;

  await recordSessionMasteryIfMissing(supabase, {
    userId: input.userId,
    conceptId,
    sessionId,
    understood,
    subject,
    chapter,
  });

  await markCachedSessionCardCompleted(supabase, {
    userId: input.userId,
    goalId: input.goalId ?? null,
  }).catch((error) => {
    logger.warn('Session card completion marker skipped', {
      userId: input.userId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
  
  const streakChanged = rpcResult.streak_changed ?? false;
  const newStreak = rpcResult.streak_days ?? 0;

  logger.info('Session completion persisted', {
    userId: input.userId,
    feature: 'session-completion',
    sessionId,
    conceptId,
    durationMs: Date.now() - startedAt,
    streakChanged,
  });

  return {
    sessionId,
    conceptId,
    streakDays: newStreak,
    streakChanged,
    subject,
    chapter,
    understood,
    cardsCreated,
  };
}
