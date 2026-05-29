// app/api/events/process/route.ts
// Called by: 1) after() dispatch, 2) retry cron, 3) manual recovery
// This endpoint is the single entry point for consumer execution.
import { NextRequest } from 'next/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';

// Verify this is an internal call (not public)
function verifyInternalCall(req: NextRequest): boolean {
  const internalSecret = req.headers.get('x-internal-cron');
  return internalSecret === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!verifyInternalCall(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { eventId } = body;
  if (!eventId || typeof eventId !== 'string') {
    return new Response('eventId required', { status: 400 });
  }

  try {
    await EventDispatcher.runAllConsumers(eventId);
    return Response.json({ success: true, eventId });
  } catch (err: any) {
    logger.error('Event process endpoint failed', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
