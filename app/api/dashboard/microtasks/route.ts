import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DailyMicrotaskService } from '@/lib/services/daily-microtask.service';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const goalId = searchParams.get('goalId');
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    const service = new DailyMicrotaskService(supabase);
    const tasks = await service.getMicrotasksForDate(user.id, date, goalId);

    return NextResponse.json({ tasks });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'microtasks_get');
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'microtasks_write',
      maxTokens: 30,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const body = await req.json();
    const service = new DailyMicrotaskService(supabase);
    const goalId = typeof body.goalId === 'string' && body.goalId.trim() ? body.goalId.trim() : null;
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    if (body.action === 'add') {
      const task = await service.addMicrotask({
        user_id: user.id,
        goal_id: goalId,
        session_card_id: body.session_card_id,
        task_date: body.task_date || new Date().toISOString().split('T')[0],
        title: body.title,
        subject: body.subject,
        topic: body.topic,
        type: body.type || 'custom',
        estimated_minutes: body.estimated_minutes || 15,
        target_count: body.target_count,
        status: 'pending',
        priority: body.priority || 'medium',
        source: body.source || 'user',
      });
      return NextResponse.json({ task });
    } else if (body.action === 'update_status') {
      const task = await service.updateMicrotaskStatus(body.id, user.id, body.status);
      return NextResponse.json({ task });
    } else if (body.action === 'delete') {
      await service.deleteMicrotask(body.id, user.id);
      return NextResponse.json({ success: true });
    }

    return apiErrorResponse('invalid_action', { status: 400, message: 'Invalid action.', requestId });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'microtasks_post');
  }
}
