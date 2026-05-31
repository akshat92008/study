// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { StudentEventInputSchema } from '@/lib/events/schema';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

// Public browser-origin event publishing is fail-closed for production MVP.
// Add explicit client-safe event types here only after their payload contract,
// consumers, and authorization semantics are reviewed.
const CLIENT_EVENT_TYPE_ALLOWLIST = new Set<string>();

export async function POST(req: Request) {
  try {
    const requestId = getRequestId(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const body = StudentEventInputSchema.parse(await req.json());
    if (!CLIENT_EVENT_TYPE_ALLOWLIST.has(body.type)) {
      return apiErrorResponse('event_not_publishable', {
        status: 403,
        message: 'Event type is not client-publishable.',
        requestId,
      });
    }

    const eventId = await EventDispatcher.publish({
      userId: user.id,
      type: body.type,
      source: body.source ?? 'client',
      data: body.data,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ ok: true, eventId }, { headers: { 'x-request-id': requestId } });
  } catch (err: any) {
    const requestId = getRequestId(req);
    if (err?.name === 'ZodError') {
      return apiErrorResponse('invalid_event_payload', {
        status: 400,
        message: 'Invalid event payload.',
        details: err.errors,
        requestId,
      });
    }
    return unexpectedApiErrorResponse(req, err, 'events', 'Failed to publish event.');
  }
}
