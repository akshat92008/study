// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { StudentEventInputSchema } from '@/lib/events/schema';

// Public browser-origin event publishing is fail-closed for production MVP.
// Add explicit client-safe event types here only after their payload contract,
// consumers, and authorization semantics are reviewed.
const CLIENT_EVENT_TYPE_ALLOWLIST = new Set<string>();

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = StudentEventInputSchema.parse(await req.json());
    if (!CLIENT_EVENT_TYPE_ALLOWLIST.has(body.type)) {
      return NextResponse.json({ error: 'Event type is not client-publishable' }, { status: 403 });
    }

    const eventId = await EventDispatcher.publish({
      userId: user.id,
      type: body.type,
      source: body.source ?? 'client',
      data: body.data,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ ok: true, eventId });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid event payload', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message || 'Failed to publish event' }, { status: 500 });
  }
}
