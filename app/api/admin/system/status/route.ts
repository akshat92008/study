import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { env } from '@/lib/utils/env';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);

  // Simple auth check via basic auth or bearer token matching CRON_SECRET or ADMIN_EMAILS
  const authHeader = req.headers.get('authorization');
  let isAuthorized = false;

  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token === process.env.CRON_SECRET) {
      isAuthorized = true;
    }
  }

  // Allow passing ?secret=xxx for simple manual queries
  const url = new URL(req.url);
  if (url.searchParams.get('secret') === process.env.CRON_SECRET) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return apiErrorResponse('unauthorized', { status: 401, message: 'Admin authentication required', requestId });
  }

  try {
    const supabase = createAdminClient();

    // 1. Queue Status
    const [
      pending, processing, failed, dlq, lastAttempt
    ] = await Promise.all([
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
      supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DLQ']),
      supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
      supabase.from('event_attempts').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
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
      'CRON_SECRET',
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

    return NextResponse.json({
      status: 'ok',
      queue: {
        pendingEvents: pending.count || 0,
        processingEvents: processing.count || 0,
        failedEvents: failed.count || 0,
        dlqCount: dlq.count || 0,
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
