import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { rejectAgentAction } from '@/lib/agents/agent-runtime';
import { EventDispatcher } from '@/lib/events/orchestrator';

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
    const action = await rejectAgentAction(params.id, user.id, typeof body.reason === 'string' ? body.reason : undefined, { client: supabase });
    
    if (action.action_type === 'uncertain_autopsy_mistake') {
      await EventDispatcher.publish({
        user_id: user.id,
        type: 'AUTOPSY_MISTAKE_REJECTED',
        data: { actionId: action.id, targetId: action.target_id, evidence: action.evidence },
        metadata: { source: 'agent_approval_api' },
        idempotency_key: `autopsy_mistake_rejected:${action.id}`
      }).catch(err => console.warn('Failed to publish AUTOPSY_MISTAKE_REJECTED', err));
    }

    return NextResponse.json({ action }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'agent-action-reject', 'Unable to reject agent action.');
  }
}
