import { NextRequest } from 'next/server';
import { getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';
import { readPatternMemoriesForUser } from '@/lib/amaura/agents/repositories';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { user, limits } = auth;
    const { searchParams } = new URL(req.url);
    const reminders = await readPatternMemoriesForUser(user.id, {
      goalId: searchParams.get('goalId'),
      status: 'active',
      limit: limits.maxReminders,
    });
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    const filtered = reminders.filter((memory: any) =>
      (!subject || memory.subject === subject) &&
      (!topic || memory.topic === topic)
    );
    return jsonWithRequestId({ reminders: filtered }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_reminders', 'Unable to load Deep Autopsy reminders.');
  }
}
