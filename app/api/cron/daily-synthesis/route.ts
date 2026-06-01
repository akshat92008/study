import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 60;
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const date = new Date().toISOString().slice(0, 10);
  const activeSince = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const limit = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get('limit') || 500)));

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, last_active_at')
    .gte('last_active_at', activeSince)
    .order('last_active_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Daily synthesis failed to load active users', { error: error.message });
    return NextResponse.json({ error: 'daily_synthesis_user_load_failed' }, { status: 500 });
  }

  const results = await Promise.allSettled(
    (profiles ?? []).map((profile: any) =>
      EventDispatcher.publish({
        user_id: profile.id,
        type: 'STUDENT_MODEL_SYNC_REQUESTED',
        data: {
          date,
          reason: 'daily_synthesis',
          lastActiveAt: profile.last_active_at,
        },
        metadata: { source: 'daily_synthesis_cron', date },
        idempotency_key: `daily_synthesis:${profile.id}:${date}`,
      })
    )
  );

  const enqueued = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - enqueued;

  if (failed > 0) {
    logger.warn('Daily synthesis enqueue completed with failures', { date, enqueued, failed });
  } else {
    logger.info('Daily synthesis enqueue complete', { date, enqueued });
  }

  return NextResponse.json({
    ok: failed === 0,
    mode: 'queued',
    date,
    activeUsers: profiles?.length ?? 0,
    enqueued,
    failed,
  });
}
