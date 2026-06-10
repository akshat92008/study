import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completeLearningSession } from '@/lib/services/session-completion';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { generateSessionClosingMessage } from '@/lib/engines/session-closing';
import { runHermesTurn } from '@/lib/agent/runtime';
import { logger } from '@/lib/utils/logger';

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
      goalId: body.goalId ?? null,
      source: 'session',
      idempotencyKey: req.headers.get('Idempotency-Key'),
      client: supabase,
    });

    const closing = await generateSessionClosingMessage({
      userId: user.id,
      conceptId: result.conceptId,
      subject: result.subject || 'General',
      chapter: result.chapter || 'General',
      gapFound: body.gapFound ?? null,
      gapAnswer: null,
      understood: result.understood,
      turnsCount: 1,
      oldMastery: null,
      newMastery: null,
      cardsCreated: result.cardsCreated,
      sessionId: result.sessionId,
    }).catch(() => null);

    // Phase 7: Wire session through agent runtime for ATLAS/MEMORY mutations
    // The runtime processes session completion, creates MEMORY cards, and updates ATLAS mastery
    let agentLoopResult: any = null;
    try {
      agentLoopResult = await runHermesTurn({
        userId: user.id,
        channel: 'session',
        goalId: body.goalId ?? undefined,
        payload: {
          sessionId: result.sessionId,
          conceptId: result.conceptId,
          subject: result.subject,
          chapter: result.chapter,
          conceptName: body.conceptName ?? body.chapter ?? null,
          durationMinutes: body.durationMinutes ?? 25,
          understood: result.understood,
          gapFound: body.gapFound ?? null,
          cardsCreated: result.cardsCreated,
          source: 'complete_session',
          alreadyCompleted: true, // Fix 7: Tell runtime this session is already saved
        },
        sessionId: undefined,
      }, { supabase: supabase as any });

      logger.info('Session agent runtime completed', {
        userId: user.id,
        sessionId: result.sessionId,
        changed: agentLoopResult?.mutationSummary?.changed,
        conceptsUpdated: agentLoopResult?.mutationSummary?.conceptsUpdated,
        revisionCardsCreated: agentLoopResult?.mutationSummary?.revisionCardsCreated,
      });
    } catch (runtimeError) {
      // Runtime failure should not fail session close - runtime is for agent mutations
      logger.warn('Session agent runtime failed (non-fatal)', {
        userId: user.id,
        sessionId: result.sessionId,
        error: runtimeError instanceof Error ? runtimeError.message : String(runtimeError),
      });
    }

    return NextResponse.json({
      success: true,
      streakDays: result.streakDays,
      streakChanged: result.streakChanged,
      sessionId: result.sessionId,
      conceptId: result.conceptId,
      closingMessage: closing?.text ?? null,
      closingType: closing?.type ?? null,
      agentMutationSummary: agentLoopResult?.mutationSummary ?? null,
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(req, error, 'complete-session', 'Session completion failed.');
  }
}
