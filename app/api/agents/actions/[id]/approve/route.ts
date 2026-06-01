import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { approveAgentAction } from '@/lib/agents/agent-runtime';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(req: NextRequest, context: RouteContext) {
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

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'agent-actions',
      maxTokens: 30,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const params = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = await approveAgentAction(params.id, user.id, typeof body.reason === 'string' ? body.reason : undefined);
    return NextResponse.json({ action }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'agent-action-approve', 'Unable to approve agent action.');
  }
}
