import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { getActiveGoalContext } from '@/lib/services/goal-context.service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const params = await context.params;
    const goalContext = await getActiveGoalContext(supabase, user.id, params.id);
    return NextResponse.json({ success: true, ...goalContext }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    const message = error?.message === 'Learning goal not found.'
      ? 'Learning goal not found.'
      : 'Unable to load learning goal context.';
    const status = error?.message === 'Learning goal not found.' ? 404 : 500;

    if (status === 404) {
      return apiErrorResponse('not_found', { status, message, requestId });
    }

    return unexpectedApiErrorResponse(req, error, 'goal_context_get', message);
  }
}
