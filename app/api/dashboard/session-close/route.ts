import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { completeLearningSession } from '@/lib/services/session-completion';
import { logger } from '@/lib/utils/logger';

const MASTERY_NUMERIC: Record<string, number> = {
  not_started: 0,
  exposed: 0.15,
  developing: 0.40,
  proficient: 0.70,
  mastered: 0.90,
  automated: 0.98,
};

function masteryToNumeric(level: string | null | undefined): number | null {
  return level ? MASTERY_NUMERIC[level] ?? null : null;
}

export async function POST(req: NextRequest) {
  try {
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

    const result = await completeLearningSession({
      userId: user.id,
      subject: subject || 'General',
      chapter: conceptName,
      conceptName,
      durationMinutes: sessionDurationMinutes,
      understood,
      gapFound,
      cardsCreated,
      source: 'session_close',
      idempotencyKey: req.headers.get('Idempotency-Key'),
      client: supabase,
    });

    const { data: conceptAfter } = result.conceptId
      ? await supabase
          .from('concepts')
          .select('mastery')
          .eq('id', result.conceptId)
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null };

    const closing = await generateSessionClosingMessage({
      userId: user.id,
      conceptId: result.conceptId,
      subject: result.subject,
      chapter: result.chapter,
      gapFound,
      gapAnswer: null,
      understood,
      turnsCount: 0,
      oldMastery: null,
      newMastery: masteryToNumeric(conceptAfter?.mastery),
      cardsCreated,
      sessionId: result.sessionId,
    });

    return NextResponse.json({
      newStreak: result.streakDays,
      closingMessage: closing.text,
      messageType: closing.type,
      oldMastery: null,
      newMastery: conceptAfter?.mastery ?? null,
      masteryChanged: Boolean(conceptAfter?.mastery),
      cardsCreated,
      sessionId: result.sessionId,
      conceptId: result.conceptId,
    });
  } catch (error: any) {
    logger.error('session-close error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
