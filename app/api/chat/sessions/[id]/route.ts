import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/utils/logger';
import {
  ensureGoalForUser,
  ensureSessionGoalLink,
  SESSION_SELECT,
} from '@/lib/services/goal-context.service';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    const body = await req.json();
    const updates: Record<string, any> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }

    if (typeof body.archive === 'boolean') {
      updates.archived_at = body.archive ? new Date().toISOString() : null;
    }

    if (typeof body.goalId === 'string' && body.goalId.trim()) {
      const linked = await ensureSessionGoalLink(supabase, user.id, id, body.goalId.trim());
      if (body.setPrimary === true) {
        await supabase
          .from('chat_sessions')
          .update({ is_primary_for_goal: false })
          .eq('user_id', user.id)
          .eq('goal_id', body.goalId.trim())
          .neq('id', id);
        await supabase
          .from('learning_goals')
          .update({ primary_chat_session_id: id, last_active_at: new Date().toISOString() })
          .eq('id', body.goalId.trim())
          .eq('user_id', user.id);
        updates.is_primary_for_goal = true;
      }
      Object.assign(updates, {
        goal_id: linked.goal_id,
        session_type: linked.session_type,
        is_global: false,
      });
    }

    if (body.setPrimary === true && !body.goalId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('goal_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!session?.goal_id) {
        return apiErrorResponse('bad_request', { status: 400, message: 'Learning goal is required.', requestId });
      }
      await ensureGoalForUser(supabase, user.id, session.goal_id);
      await supabase
        .from('chat_sessions')
        .update({ is_primary_for_goal: false })
        .eq('user_id', user.id)
        .eq('goal_id', session.goal_id)
        .neq('id', id);
      await supabase
        .from('learning_goals')
        .update({ primary_chat_session_id: id, last_active_at: new Date().toISOString() })
        .eq('id', session.goal_id)
        .eq('user_id', user.id);
      updates.is_primary_for_goal = true;
    }

    if (Object.keys(updates).length === 0) {
      return apiErrorResponse('bad_request', { status: 400, message: 'No session updates provided.', requestId });
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(SESSION_SELECT)
      .single();

    if (error) throw error;
    return NextResponse.json({ session: data }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to update chat session', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to update session', requestId });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    const { data: session } = await supabase
      .from('chat_sessions')
      .select('goal_id, is_primary_for_goal')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    const { error } = await supabase
      .from('chat_sessions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_global', false);

    if (error) throw error;

    if (session?.goal_id && session.is_primary_for_goal) {
      await supabase
        .from('learning_goals')
        .update({ primary_chat_session_id: null })
        .eq('id', session.goal_id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to delete chat session', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to delete session', requestId });
  }
}
