import { NextResponse } from 'next/server';
import { getSyllabusMastery } from '@/lib/services/atlasService';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';

export const GET = withRateLimit('atlas', async (req, userId) => {
  const requestId = getRequestId(req);
  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get('goalId');
  if (goalId) {
    const supabase = await createClient();
    await ensureGoalForUser(supabase, userId, goalId);
  }
  const mastery = await getSyllabusMastery(userId, goalId);
  if (!mastery) {
    return apiErrorResponse('not_found', {
      status: 404,
      message: 'No syllabus data found.',
      requestId,
    });
  }

  return NextResponse.json(mastery, { headers: { 'x-request-id': requestId } });
});
