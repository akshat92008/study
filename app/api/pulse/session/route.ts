import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { durationMinutes } = await request.json();

    if (!durationMinutes || durationMinutes < 1) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const { error } = await supabase.from('study_sessions').insert({
      user_id: user.id,
      duration_minutes: durationMinutes,
      started_at: new Date(Date.now() - durationMinutes * 60000).toISOString(),
      ended_at: new Date().toISOString(),
      notes: 'Auto-tracked by background telemetry',
    });

    if (error) throw error;

    logger.info('Study session logged via telemetry', { userId: user.id, durationMinutes });
    return NextResponse.json({ success: true });

  } catch (error: any) {
    logger.error('Failed to log study session', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
