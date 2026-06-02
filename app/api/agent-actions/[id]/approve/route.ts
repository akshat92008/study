import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { approveAgentAction } from '@/lib/agents/agent-runtime';
import { applyApprovedAgentAction } from '@/lib/agents/action-executor';

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
    const { data: current, error } = await supabase
      .from('agent_actions')
      .select('id, status, approval_status, risk_level')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!current) return apiErrorResponse('not_found', { status: 404, message: 'Agent action not found.', requestId });
    if (!['proposed', 'pending_approval'].includes(current.status) && current.approval_status !== 'pending') {
      return apiErrorResponse('invalid_agent_action_state', {
        status: 409,
        message: 'Only proposed actions can be approved.',
        requestId,
      });
    }

    const approved = await approveAgentAction(
      params.id,
      user.id,
      typeof body.reason === 'string' ? body.reason : undefined,
      { client: supabase }
    );
    const action = approved.risk_level === 'requires_approval'
      ? await applyApprovedAgentAction(params.id, user.id, { client: supabase })
      : approved;

    return NextResponse.json({ action }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'agent-action-approve', 'Unable to approve agent action.');
  }
}
