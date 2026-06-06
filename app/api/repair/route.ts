import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { getRepairSignals } from '@/lib/services/repair-loop.service';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get('goalId');
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    const signals = await getRepairSignals(supabase, { userId: user.id, goalId });
    const topRetest = signals.dueRetests[0] ?? null;
    const topMistake = signals.activeMistakes[0] ?? null;
    const primaryRisk = topRetest?.mistake ?? topMistake ?? null;

    return NextResponse.json({
      dueRetests: signals.dueRetests,
      activeMistakes: signals.activeMistakes,
      primaryRisk,
      headline: primaryRisk
        ? `What mark am I at risk of losing again today? ${primaryRisk.concept || primaryRisk.topic || primaryRisk.mistake_text}`
        : 'No active repair risk today.',
    }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'repair_get', 'Unable to load repair signals.');
  }
}
