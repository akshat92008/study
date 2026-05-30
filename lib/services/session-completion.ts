import { createClient } from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { invalidateSessionCards } from '@/lib/services/session-card-cache';
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

async function updateStreak(
  supabase: any,
  userId: string
): Promise<{ streakDays: number; streakChanged: boolean }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_active_at')
    .eq('id', userId)
    .single();

  const today = new Date().toISOString().split('T')[0];
  const lastActiveDate = profile?.last_active_at
    ? String(profile.last_active_at).split('T')[0]
    : null;

  let streakDays = profile?.streak_days || 0;
  let streakChanged = false;

  if (lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    streakDays = lastActiveDate === yesterday ? streakDays + 1 : 1;
    streakChanged = true;
  }

  const updatePayload: Record<string, any> = {
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (streakChanged) updatePayload.streak_days = streakDays;

  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (error) throw new Error(`Failed to update streak: ${error.message}`);

  return { streakDays, streakChanged };
}

export async function completeLearningSession(
  input: CompleteLearningSessionInput
): Promise<CompleteLearningSessionResult> {
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
      .select('id, subject, chapter')
      .eq('user_id', input.userId)
      .eq('metadata->>completion_key', completionKey)
      .maybeSingle();

    if (existing?.id) {
      const { streakDays, streakChanged } = await updateStreak(supabase, input.userId);
      return {
        sessionId: existing.id,
        conceptId: null,
        streakDays,
        streakChanged,
        subject: existing.subject || subject,
        chapter: existing.chapter || chapter,
        understood,
        cardsCreated,
      };
    }
  }

  if (input.taskId) {
    const { error: taskError } = await supabase
      .from('study_tasks')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', input.taskId)
      .eq('user_id', input.userId);

    if (taskError) throw new Error(`Failed to complete task: ${taskError.message}`);
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

  const endedAt = new Date().toISOString();
  const { data: sessionRecord, error: sessionError } = await supabase
    .from('study_sessions')
    .insert({
      user_id: input.userId,
      subject,
      chapter,
      topic: conceptName,
      concept_name: conceptName,
      started_at: new Date(Date.now() - durationMinutes * 60_000).toISOString(),
      ended_at: endedAt,
      completed_at: endedAt,
      duration_minutes: durationMinutes,
      understood,
      gap_found: input.gapFound ?? null,
      cards_created: cardsCreated,
      session_type: input.sessionType || 'study',
      is_completed: true,
      notes: input.gapFound ? `Gap identified: ${input.gapFound}` : `Studied ${chapter} (${subject})`,
      metadata: {
        completion_key: completionKey,
        source,
        taskId: input.taskId ?? null,
        conceptId,
      },
    })
    .select('id')
    .single();

  if (sessionError || !sessionRecord?.id) {
    throw new Error(sessionError?.message || 'Failed to save study session');
  }

  const { streakDays, streakChanged } = await updateStreak(supabase, input.userId);

  if (conceptId) {
    await recordMasteryEvidence({
      userId: input.userId,
      conceptId,
      evidenceType: understood ? 'tutor_understood' : 'tutor_confused',
      source: source === 'session_close' ? 'session_close' : 'tutor_session',
      sourceId: sessionRecord.id,
      evidence: understood
        ? `Completed session on ${chapter}`
        : `Session on ${chapter} surfaced gap${input.gapFound ? `: ${input.gapFound}` : ''}`,
      client: supabase,
    });
  }

  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'COMMAND_SESSION_COMPLETED',
    data: {
      sessionId: sessionRecord.id,
      taskId: input.taskId || `session-${sessionRecord.id}`,
      conceptId,
      conceptName,
      subject,
      chapter,
      durationMinutes,
      understood,
      gapFound: input.gapFound ?? null,
      cardsCreated,
      understandingGained: understood,
      isSessionComplete: true,
      masteryEvidenceRecorded: Boolean(conceptId),
    },
    metadata: { source },
    idempotency_key: completionKey || `${source}:${sessionRecord.id}`,
  });

  await invalidateSessionCards(input.userId, supabase, 'study_session_completed').catch(err => {
    logger.warn('Failed to invalidate session cards after completion', err);
  });

  return {
    sessionId: sessionRecord.id,
    conceptId,
    streakDays,
    streakChanged,
    subject,
    chapter,
    understood,
    cardsCreated,
  };
}
