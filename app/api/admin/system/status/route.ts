import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);

  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createAdminClient();

    // 1. Queue Status
    const [
      pending, processing, failed, dlq, lastAttempt, oldestPending, stuckLocks
    ] = await Promise.all([
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DLQ']),
      supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      supabase.from('event_attempts').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('event_queue').select('created_at').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabase.from('consumer_locks').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING').lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()),
    ]);

    // 2. DB Check
    const dbStart = Date.now();
    let dbStatus = 'ok';
    try {
      await supabase.from('profiles').select('id').limit(1);
    } catch {
      dbStatus = 'failed';
    }

    // 3. Env config check
    const requiredEnv = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    const envStatus = missingEnv.length === 0 ? 'ok' : 'missing';

    // 4. Recent Failures
    const { data: recentFailures } = await supabase
      .from('event_dlq')
      .select('id, event_type, error_message, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    const oldestPendingAgeSeconds = oldestPending.data?.created_at
      ? Math.max(0, Math.round((Date.now() - new Date(oldestPending.data.created_at).getTime()) / 1000))
      : 0;
    const stuckLocksCount = stuckLocks.count || 0;
    const dlqCount = dlq.count || 0;
    const pendingEvents = pending.count || 0;

    let queueHealth = 'GREEN';
    if (dlqCount > 0 || oldestPendingAgeSeconds > 600) {
      queueHealth = 'YELLOW';
    }
    if (dlqCount > 50 || oldestPendingAgeSeconds > 1800 || stuckLocksCount > 0) {
      queueHealth = 'RED';
    }

    return NextResponse.json({
      status: 'ok',
      health: queueHealth,
      queue: {
        pendingEvents,
        processingEvents: processing.count || 0,
        failedEvents: failed.count || 0,
        dlqCount,
        stuckLocksCount,
        oldestPendingAgeSeconds,
        lastWorkerRunAt: lastAttempt.data?.finished_at ?? null,
      },
      db: { status: dbStatus, latencyMs: Date.now() - dbStart },
      env: { status: envStatus, missing: missingEnv },
      recentFailures: recentFailures || [],
      appInfo: {
        version: process.env.npm_package_version || '0.1.0',
        nodeEnv: process.env.NODE_ENV,
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      },
      timestamp: new Date().toISOString()
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return apiErrorResponse('internal_error', { status: 500, message: 'Admin status check failed', requestId });
  }
}
