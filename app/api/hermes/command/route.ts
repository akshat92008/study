import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';
import {
  classifyHermesIntent,
  executeHermesPlan,
  getHermesUserState,
  planHermesAction,
} from '@/lib/hermes/ui';

export const dynamic = 'force-dynamic';

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
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
      bucket: 'hermes-command',
      maxTokens: 30,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const body = await req.json().catch(() => ({}));
    const message = optionalString(body.message);
    if (!message || message.length > 4000) {
      return apiErrorResponse('invalid_message', {
        status: 400,
        message: 'Hermes command message is required.',
        requestId,
      });
    }

    const goalId = optionalString(body.goalId);
    const intent = classifyHermesIntent(message);
    const state = await getHermesUserState(supabase, user.id, goalId);
    const plan = planHermesAction(intent, state, message);

    if (plan.costMode === 'heavy') {
      logger.info('Hermes Heavy planned', {
        userId: user.id,
        goalId: goalId ?? state.activeGoal?.id ?? null,
        intent: intent.type,
        reason: plan.tools[0]?.heavyReason ?? intent.reason,
        route: '/api/hermes/command',
      });
    }

    const executed = await executeHermesPlan({
      supabase,
      userId: user.id,
      goalId,
      intent,
      state,
      message,
      plan,
    });

    return NextResponse.json({
      success: true,
      intent,
      cards: executed.cards,
      usedLLM: executed.usedLLM,
      costMode: executed.costMode,
      warnings: executed.warnings,
    }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'hermes_command', 'Hermes could not complete that command.');
  }
}
