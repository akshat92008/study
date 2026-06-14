import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import {
  getActiveGoalContext,
  GOAL_SELECT,
} from '@/lib/services/goal-context.service';
import { logger } from '@/lib/utils/logger';
import { createResolvedLearningGoal } from '@/lib/goals/curriculum-resolver';
import { createAmauraGoalLoopForExistingGoal } from '@/lib/amaura/goal-loop';

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
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

    const { data, error } = await supabase
      .from('learning_goals')
      .select(GOAL_SELECT)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const goals = await Promise.all((data ?? []).map(async (goal: any) => {
      try {
        const context = await getActiveGoalContext(supabase, user.id, goal.id);
        return { ...goal, counts: context.counts, nextAction: context.nextAction };
      } catch (err) {
        logger.warn('Failed to attach compact goal counts', {
          userId: user.id,
          goalId: goal.id,
          err,
        });
        return goal;
      }
    }));

    return NextResponse.json({ success: true, goals }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'goals_get', 'Unable to load learning goals.');
  }
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

    const body = await req.json().catch(() => ({}));
    const rawTitle =
      typeof body?.title === 'string'
        ? body.title
        : typeof body?.goal === 'string'
          ? body.goal
          : typeof body?.name === 'string'
            ? body.name
            : '';
    const title = rawTitle.trim();
    if (!title) {
      return apiErrorResponse('invalid_goal', {
        status: 400,
        message: 'Please enter a specific learning goal before creating it.',
        requestId,
      });
    }

    const result = await createResolvedLearningGoal({
      supabase,
      userId: user.id,
      title,
      details: {
        subject: optionalString(body.subject),
        domain: optionalString(body.domain),
        examType: optionalString(body.examType),
        presetId: optionalString(body.presetId),
        targetLevel: optionalString(body.targetLevel),
        description: optionalString(body.description),
        deadline: optionalString(body.deadline),
        currentLevel: optionalString(body.currentLevel),
        timeAvailable: body.timeAvailable ?? null,
        preferredLearningStyle: optionalString(body.preferredLearningStyle),
        goalType: optionalString(body.goalType),
        targetDate: optionalString(body.targetDate ?? body.target_date),
      },
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'needs_clarification',
        message: result.clarificationQuestion || 'Please make the goal more specific, for example "solutions", "mechanical properties of fluids", or "NEET physics revision".',
        inferred: result.domain,
        suggestions: result.suggestions,
      }, { status: 409, headers: { 'x-request-id': requestId } });
    }

    const agenticLoop = await createAmauraGoalLoopForExistingGoal({
      userId: user.id,
      goalId: result.goalId,
      source: 'api.goals.create',
      sourceEventId: requestId,
    }).catch((err) => {
      logger.warn('Amaura goal loop failed after goal creation', {
        userId: user.id,
        goalId: result.goalId,
        requestId,
        err: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

    return NextResponse.json({
      success: true,
      goal: result.goal,
      session: result.session,
      goalId: result.goalId,
      sessionId: result.sessionId,
      topicSeeding: result.topicSeeding,
      mission: result.mission,
      amaura: agenticLoop ? {
        tasksCreated: agenticLoop.tasks.length,
        nextAction: agenticLoop.nextAction,
        skipped: 'skipped' in agenticLoop ? agenticLoop.skipped : false,
      } : {
        tasksCreated: 0,
        nextAction: null,
        skipped: true,
      },
      domain: result.domain,
      normalizedGoal: result.normalizedGoal,
    }, { status: 201, headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'goals_post', 'Unable to create learning goal.');
  }
}
