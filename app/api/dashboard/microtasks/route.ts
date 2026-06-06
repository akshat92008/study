import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DailyMicrotaskService } from '@/lib/services/daily-microtask.service';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { completeAmauraGoalLoopTask } from '@/lib/amaura/goal-loop';
import { computeGoalProgress, updateGoal } from '@/lib/amaura/goals/goal-repository';
import { recordObservationIfNotExists } from '@/lib/amaura/observations/observation-repository';
import { logger } from '@/lib/utils/logger';

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
      const linkedGoalId = task.goal_id ?? goalId;
      if (linkedGoalId && body.status === 'done') {
        await completeAmauraGoalLoopTask({
          userId: user.id,
          goalId: linkedGoalId,
          taskId: task.id,
          outcome: {
            confidence: body.confidence,
            weakTopic: typeof body.weakTopic === 'string' ? body.weakTopic : null,
            score: typeof body.score === 'number' ? body.score : null,
            notes: typeof body.notes === 'string' ? body.notes : null,
          },
        }).catch((err) => {
          logger.warn('Amaura task completion loop failed', {
            userId: user.id,
            goalId: linkedGoalId,
            taskId: task.id,
            err: err instanceof Error ? err.message : String(err),
          });
        });
      } else if (linkedGoalId && body.status === 'skipped') {
        await recordObservationIfNotExists({
          userId: user.id,
          goalId: linkedGoalId,
          taskId: task.id,
          source: 'task',
          observationType: 'skipped',
          subject: task.subject ?? null,
          topic: task.topic ?? null,
          confidence: 0.7,
          payload: {
            taskTitle: task.title,
            reason: typeof body.reason === 'string' ? body.reason : null,
          },
          sourceEventId: `daily_microtask:${task.id}:skipped`,
        }).catch((err) => {
          logger.warn('Amaura skipped-task observation failed', {
            userId: user.id,
            goalId: linkedGoalId,
            taskId: task.id,
            err: err instanceof Error ? err.message : String(err),
          });
        });
        const progress = await computeGoalProgress(linkedGoalId, user.id).catch(() => null);
        if (progress) {
          await updateGoal(linkedGoalId, user.id, {
            progressPercent: progress.progressPercent,
            riskLevel: progress.skippedTasks > 1 ? 'high' : 'medium',
            currentState: {
              ...progress,
              lastSkippedTaskId: task.id,
            },
            lastEvaluatedAt: new Date().toISOString(),
          }).catch((err) => {
            logger.warn('Amaura skipped-task progress update failed', {
              userId: user.id,
              goalId: linkedGoalId,
              taskId: task.id,
              err: err instanceof Error ? err.message : String(err),
            });
          });
        }
      }
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
