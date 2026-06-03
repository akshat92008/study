import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/utils/logger';
import {
  ensureGoalForUser,
  getOrCreatePrimaryGoalSession,
  SESSION_SELECT,
} from '@/lib/services/goal-context.service';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    const { data, error } = await supabase
      .from('chat_sessions')
      .select(`${SESSION_SELECT}, learning_goals(title)`)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    const sessions = (data || []).map((session: any) => ({
      id: session.id,
      title: session.title,
      goal_id: session.goal_id,
      is_primary_for_goal: session.is_primary_for_goal,
      session_type: session.session_type,
      is_global: session.is_global,
      updated_at: session.updated_at,
      created_at: session.created_at,
      goal_title: Array.isArray(session.learning_goals)
        ? session.learning_goals[0]?.title ?? null
        : session.learning_goals?.title ?? null,
    }));
    return NextResponse.json({ sessions }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to load chat sessions', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to load sessions', requestId });
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : 'New Chat';
    const goalId = typeof body.goalId === 'string' && body.goalId.trim()
      ? body.goalId.trim()
      : null;
    const requestedType = typeof body.sessionType === 'string' ? body.sessionType : undefined;
    const sessionType = ['goal', 'quick', 'thread', 'tutor', 'practice'].includes(requestedType ?? '')
      ? requestedType
      : goalId
        ? 'goal'
        : 'thread';

    if (goalId) {
      await ensureGoalForUser(supabase, user.id, goalId);
      if (sessionType === 'goal') {
        const primary = await getOrCreatePrimaryGoalSession(supabase, user.id, goalId);
        return NextResponse.json({ session: primary }, { status: 201, headers: { 'x-request-id': requestId } });
      }
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        is_global: false,
        title,
        goal_id: goalId,
        is_primary_for_goal: false,
      })
      .select(SESSION_SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ session: data }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to create chat session', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to create session', requestId });
  }
}
