// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { StudentEventInputSchema } from '@/lib/events/schema';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = StudentEventInputSchema.parse(await req.json());

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
