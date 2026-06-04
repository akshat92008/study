import { NextRequest } from 'next/server';
import { getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { getRelevantHermesReminders } from '@/lib/autopsy-v3/hermes-memory-writer';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;
    const { searchParams } = new URL(req.url);
    const reminders = await getRelevantHermesReminders({
      supabase,
      userId: user.id,
      goalId: searchParams.get('goalId'),
      subject: searchParams.get('subject'),
      topic: searchParams.get('topic'),
      limit: limits.maxReminders,
    });
    return jsonWithRequestId({ reminders }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_reminders', 'Unable to load Deep Autopsy reminders.');
  }
}
