import { createClient } from '@/lib/supabase/server';
import { resolveConcept } from '@/lib/engines/concept-resolver';
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
    logger.error('Session completion RPC failed', sessionError, {
      userId: input.userId,
      feature: 'session-completion',
    });
    throw new Error(sessionError?.message || 'Failed to save study session via RPC');
  }

  const sessionId = rpcResult.session_id;
  logger.info('Session completion persisted', {
    userId: input.userId,
    feature: 'session-completion',
    sessionId,
    conceptId,
    durationMs: Date.now() - startedAt,
    streakChanged: Boolean(rpcResult.streak_changed),
  });

  return {
    sessionId,
    conceptId,
    streakDays: Number(rpcResult.streak_days ?? 0),
    streakChanged: Boolean(rpcResult.streak_changed),
    subject,
    chapter,
    understood,
    cardsCreated,
  };
}
