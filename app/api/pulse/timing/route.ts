import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordMessageTiming } from '@/lib/engines/pulse-engine';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // For timing telemetry, keep HTTP 200 or 401. Since it's timing, return 401 if unauthenticated, or return 200.
      // Let's return 401 if not authenticated for security, but wrap everything inside the execution block.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { responseTimeMs, messageLength } = await req.json();
    if (typeof responseTimeMs !== 'number' || typeof messageLength !== 'number') {
      return NextResponse.json({ error: 'Invalid timing payload' }, { status: 400 });
    }

    // Call recordMessageTiming (non-blocking / asynchronous)
    await recordMessageTiming(user.id, responseTimeMs, messageLength, null);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    logger.warn('Failed to record pulse timing telemetry', error);
    // Return 200 even on error as requested (non-critical telemetry)
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}
