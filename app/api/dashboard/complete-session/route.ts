import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completeLearningSession } from '@/lib/services/session-completion';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const result = await completeLearningSession({
      userId: user.id,
      taskId: body.taskId ?? null,
      subject: body.subject ?? null,
      chapter: body.chapter ?? null,
      conceptName: body.conceptName ?? body.chapter ?? null,
      durationMinutes: body.durationMinutes ?? 25,
      understood: body.understood ?? true,
      gapFound: body.gapFound ?? null,
      cardsCreated: body.cardsCreated ?? 0,
      source: 'complete_session',
      idempotencyKey: req.headers.get('Idempotency-Key'),
      client: supabase,
    });

    return NextResponse.json({
      success: true,
      streakDays: result.streakDays,
      streakChanged: result.streakChanged,
      sessionId: result.sessionId,
      conceptId: result.conceptId,
    });
  } catch (error: any) {
    logger.error('complete-session error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
