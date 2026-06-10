import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runHermesTurn, runHermesEvent } from '@/lib/agent/runtime';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAdmin();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const resolvedParams = await params;
    const runId = resolvedParams.id;
    if (!runId) {
      return apiErrorResponse('bad_request', { status: 400, message: 'Missing run id', requestId });
    }

    const body = await req.json().catch(() => ({}));
    const realRun = body.realRun === true;
    const adminConfirmed = body.adminConfirmed === true;
    const adminReason = body.adminReason;

    const supabase = createAdminClient();
    const { data: run, error } = await supabase
      .from('agent_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error || !run) {
      return apiErrorResponse('not_found', { status: 404, message: 'Agent run not found', requestId });
    }

    const { input_snapshot } = run;
    if (!input_snapshot) {
      return apiErrorResponse('bad_request', { status: 400, message: 'No input snapshot available for replay', requestId });
    }

    if (realRun && (!adminConfirmed || !adminReason)) {
      return apiErrorResponse('bad_request', { status: 400, message: 'Real replay requires admin confirmation and a reason.', requestId });
    }

    const newIdempotencyKey = realRun 
      ? `replay:${run.idempotency_key}:${adminReason}`
      : `dry-run:${run.idempotency_key}`;
    
    // Check if it's an event or turn
    const channel = input_snapshot.channel || run.trigger_source || 'background';
    const userId = run.user_id;

    if (channel === 'background' && input_snapshot.payload?.eventType) {
      if (!realRun) {
        return NextResponse.json({ success: true, newRunId: 'dry-run', output: { dryRun: true, snapshot: input_snapshot } });
      }
      const output = await runHermesEvent(
        userId,
        input_snapshot.payload.eventType,
        input_snapshot.payload.eventData || {},
        { supabase, idempotencyKey: newIdempotencyKey }
      );
      return NextResponse.json({ success: true, newRunId: output.trajectoryId, output });
    } else {
      if (!realRun) {
        return NextResponse.json({ success: true, newRunId: 'dry-run', output: { dryRun: true, snapshot: input_snapshot } });
      }
      const output = await runHermesTurn(
        {
          userId,
          channel: channel as any,
          userMessage: input_snapshot.userMessage,
          payload: input_snapshot.payload,
          conversationId: input_snapshot.conversationId,
          sessionId: input_snapshot.sessionId,
          goalId: input_snapshot.goalId,
        },
        { supabase, idempotencyKey: newIdempotencyKey }
      );
      return NextResponse.json({ success: true, newRunId: output.trajectoryId, output });
    }

  } catch (err: any) {
    return apiErrorResponse('internal_error', { status: 500, message: err.message, requestId });
  }
}
