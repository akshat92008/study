//  Route: /api/dashboard/session-close
// Updated to correctly advance mastery, log session metadata, and fire COMMAND_SESSION_COMPLETED event.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { computeAndUpdateStreak } from '@/lib/engines/streak-engine';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { advanceMastery, applyMasteryUpdate } from '@/lib/engines/mastery-updater';

// session-closing expects a 0.0–1.0 float — convert from enum
const MASTERY_NUMERIC: Record<string, number> = {
  not_started: 0,
  exposed: 0.15,
  developing: 0.40,
  proficient: 0.70,
  mastered: 0.90,
  automated: 0.98,
};
function masteryToNumeric(level: string): number | null {
  return MASTERY_NUMERIC[level] ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    conceptName,
    subject,
    sessionDurationMinutes = 0,
    understood = false,
    gapFound = null,
    cardsCreated = 0,
  } = await req.json();

  if (!conceptName) {
    return NextResponse.json({ error: 'conceptName is required' }, { status: 400 });
  }

  // 1️⃣ Update streak
  const newStreak = await computeAndUpdateStreak(user.id);

  // 2️⃣ Fetch concept record (id & current mastery)
  const { data: conceptRecord } = await supabase
    .from('concepts')
    .select('id, mastery')
    .eq('user_id', user.id)
    .ilike('name', `%${conceptName}%`)
    .maybeSingle();

  const conceptId = conceptRecord?.id ?? null;
  const oldMastery = (conceptRecord?.mastery ?? null) as MasteryLevel | null;

  // 3️⃣ Compute new mastery, persist, and record evidence trail
  let newMastery = oldMastery;
  if (conceptId && oldMastery !== null) {
    const computed = advanceMastery(oldMastery as any, understood);
    const { changed } = await applyMasteryUpdate({
      userId: user.id,
      conceptId,
      newMastery: computed,
      source: 'session_close',
      sourceId: undefined, // sessionId not yet known at this point — set below after insert
      evidence: understood
        ? `Student completed session on ${conceptName}`
        : `Student struggled with ${conceptName}${gapFound ? `: ${gapFound}` : ''}`,
    });
    if (changed) newMastery = computed;
  }

  // 4️⃣ Insert study session with rich metadata
  const endedAt = new Date().toISOString();
  const { data: sessionRecord, error: sessionErr } = await supabase
    .from('study_sessions')
    .insert({
      user_id: user.id,
      subject: subject || null,
      chapter: conceptName,
      duration_minutes: sessionDurationMinutes,
      ended_at: endedAt,
      completed_at: endedAt,
      topic: conceptName,
      concept_name: conceptName,
      understood,
      gap_found: gapFound,
      cards_created: cardsCreated,
      notes: gapFound ? `Gap identified: ${gapFound}` : null,
    })
    .select('id')
    .maybeSingle();

  if (sessionErr) {
    logger.error('Failed to insert study session', { sessionErr });
  }
  const sessionId = sessionRecord?.id ?? '';

  // 5️⃣ Publish COMMAND_SESSION_COMPLETED event for tomorrow's adaptation
  try {
    await EventDispatcher.publish({
      user_id: user.id,
      type: 'COMMAND_SESSION_COMPLETED',
      data: {
        sessionId,
        conceptId,
        conceptName,
        subject: subject || 'General',
        durationMinutes: sessionDurationMinutes,
        understood,
        gapFound,
        cardsCreated,
        oldMastery,
        newMastery,
      },
      metadata: { source: 'session_close' },
      idempotency_key: sessionId
        ? `session_close:${sessionId}`
        : `session_close:${user.id}:${endedAt}`,
    });
  } catch (eventErr) {
    logger.warn('Failed to publish COMMAND_SESSION_COMPLETED (non‑fatal)', eventErr);
  }

  // 6️⃣ Generate closing message for UI
  const closing = await generateSessionClosingMessage({
    userId: user.id,
    conceptId,
    subject: subject || 'General',
    chapter: conceptName,
    gapFound,
    gapAnswer: null,
    understood,
    turnsCount: 0,
    oldMastery: oldMastery !== null ? masteryToNumeric(oldMastery) : null,
    newMastery: newMastery !== null ? masteryToNumeric(newMastery) : null,
    cardsCreated,
    sessionId,
  });

  return NextResponse.json({
    newStreak,
    closingMessage: closing.text,
    messageType: closing.type,
    oldMastery,
    newMastery,
    masteryChanged: newMastery !== oldMastery,
    cardsCreated,
    sessionId,
  });
}
