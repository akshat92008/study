import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { approveAgentAction } from '@/lib/agents/agent-runtime';
import { EventDispatcher } from '@/lib/events/orchestrator';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };
const SUPPORTED_APPROVAL_ACTIONS = new Set(['uncertain_autopsy_mistake']);

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
    const { data: pendingAction, error: pendingError } = await supabase
      .from('agent_actions')
      .select('id, action_type, target_id, evidence')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (!pendingAction) {
      return apiErrorResponse('not_found', { status: 404, message: 'Agent action not found.', requestId });
    }
    if (!SUPPORTED_APPROVAL_ACTIONS.has(pendingAction.action_type)) {
      return apiErrorResponse('unsupported_agent_action', {
        status: 422,
        message: 'This agent action type cannot be applied through the approval endpoint yet.',
        requestId,
      });
    }

    const action = await approveAgentAction(params.id, user.id, typeof body.reason === 'string' ? body.reason : undefined, { client: supabase });
    
    if (action.action_type === 'uncertain_autopsy_mistake') {
      const evidence = action.evidence && typeof action.evidence === 'object' ? action.evidence : {};
      const mistake = (evidence as any).mistake ?? evidence;
      const wrongQuestions = Array.isArray((evidence as any).wrongQuestions)
        ? (evidence as any).wrongQuestions
        : [mistake];
      await EventDispatcher.publish({
        user_id: user.id,
        type: 'AUTOPSY_MISTAKE_APPROVED',
        data: {
          actionId: action.id,
          targetId: action.target_id,
          mistake,
          wrongQuestions,
          evidence: action.evidence,
        },
        metadata: { source: 'agent_approval_api' },
        idempotency_key: `autopsy_mistake_approved:${action.id}`
      });
    }

    return NextResponse.json({ action }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'agent-action-approve', 'Unable to approve agent action.');
  }
}
