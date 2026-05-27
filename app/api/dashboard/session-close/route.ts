//  Route: /api/dashboard/session-close
// Updated to correctly advance mastery, log session metadata, and fire COMMAND_SESSION_COMPLETED event.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { computeAndUpdateStreak } from '@/lib/engines/streak-engine';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { MASTERY_WEIGHTS } from '@/lib/engines/cognition-graph';

const MASTERY_ORDER = [
  'not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated'
] as const;

type MasteryLevel = typeof MASTERY_ORDER[number];

function advanceMastery(current: MasteryLevel | null, understood: boolean): MasteryLevel {
  if (!understood) {
    // Regression: drop one tier if not understood, floor at 'exposed'
    const idx = current ? MASTERY_ORDER.indexOf(current) : 0;
    return MASTERY_ORDER[Math.max(1, idx - 1)];
  }
  const idx = current ? MASTERY_ORDER.indexOf(current) : 0;
  if (idx === -1) return 'developing';
  // Advance one tier, cap at 'mastered' (automated requires card reviews)
  return MASTERY_ORDER[Math.min(idx + 1, 4)] as MasteryLevel;
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

  // 3️⃣ Compute new mastery and persist if changed
  let newMastery = oldMastery;
  if (conceptId && oldMastery !== null) {
    newMastery = advanceMastery(oldMastery, understood);
    if (newMastery !== oldMastery) {
      const { error: masteryErr } = await supabase
        .from('concepts')
        .update({
          mastery: newMastery,
          last_reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conceptId)
        .eq('user_id', user.id);
      if (masteryErr) {
        logger.warn('Failed to update mastery on session close', { conceptId, masteryErr });
      }
    }
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
    oldMastery: oldMastery ? (MASTERY_WEIGHTS[oldMastery as keyof typeof MASTERY_WEIGHTS] ?? null) !== null ? (MASTERY_WEIGHTS[oldMastery as keyof typeof MASTERY_WEIGHTS] ?? null)! / 100 : null : null,
    newMastery: newMastery ? (MASTERY_WEIGHTS[newMastery as keyof typeof MASTERY_WEIGHTS] ?? null) !== null ? (MASTERY_WEIGHTS[newMastery as keyof typeof MASTERY_WEIGHTS] ?? null)! / 100 : null : null,
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
