import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completeLearningSession } from '@/lib/services/session-completion';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const requestId = getRequestId(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'complete-session',
      maxTokens: 20,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

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
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(req, error, 'complete-session', 'Session completion failed.');
  }
}
