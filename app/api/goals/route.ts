import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import {
  getActiveGoalContext,
  getOrCreatePrimaryGoalSession,
  GOAL_SELECT,
  SESSION_SELECT,
} from '@/lib/services/goal-context.service';
import { logger } from '@/lib/utils/logger';
import { seedTopicsForGoal } from '@/lib/topic-seeding';

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
    const title = optionalString(body.title);
    if (!title) {
      return apiErrorResponse('invalid_goal', {
        status: 400,
        message: 'Learning goal title is required.',
        requestId,
      });
    }

    const metadata = {
      currentLevel: optionalString(body.currentLevel),
      timeAvailable: body.timeAvailable ?? null,
      preferredLearningStyle: optionalString(body.preferredLearningStyle),
    };

    const { data: goal, error: goalError } = await supabase
      .from('learning_goals')
      .insert({
        user_id: user.id,
        title,
        subject: optionalString(body.subject),
        domain: optionalString(body.domain),
        exam_type: optionalString(body.examType),
        preset_id: optionalString(body.presetId),
        target_level: optionalString(body.targetLevel),
        description: optionalString(body.description),
        target_date: optionalString(body.deadline),
        progress: 0,
        status: 'active',
        last_active_at: new Date().toISOString(),
        metadata,
      })
      .select(GOAL_SELECT)
      .single();

    if (goalError || !goal) throw goalError || new Error('Goal insert failed');

    const session = await getOrCreatePrimaryGoalSession(supabase, user.id, goal.id);

    // Seed topics deterministically or fallback to AI
    let topicSeeding: any = null;
    try {
      topicSeeding = await seedTopicsForGoal(supabase, {
        userId: user.id,
        goalId: goal.id,
        goalTitle: goal.title ?? body.title ?? body.goalTitle ?? 'Custom Goal',
        goalType: body.goalType ?? body.examType ?? body.domain ?? null,
        presetId: goal.preset_id ?? body.presetId ?? body.preset_id ?? null,
        subject: body.subject ?? null,
        subjects: Array.isArray(body.subjects)
          ? body.subjects
          : body.subject
            ? [body.subject]
            : [],
        chapter: body.chapter ?? null,
        targetDate: body.targetDate ?? body.target_date ?? null,
      });
    } catch (error) {
      console.warn('Goal topic seeding skipped after goal creation', {
        userId: user.id,
        goalId: goal.id,
        error,
      });
    }

    const { data: hydratedGoal } = await supabase
      .from('learning_goals')
      .select(GOAL_SELECT)
      .eq('id', goal.id)
      .eq('user_id', user.id)
      .single();

    const { data: hydratedSession } = await supabase
      .from('chat_sessions')
      .select(SESSION_SELECT)
      .eq('id', session.id)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      goal: hydratedGoal ?? goal,
      session: hydratedSession ?? session,
      goalId: goal.id,
      sessionId: session.id,
      topicSeeding,
    }, { status: 201, headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'goals_post', 'Unable to create learning goal.');
  }
}
