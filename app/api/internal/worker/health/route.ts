import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const now = Date.now();

  const [pending, processing, failed, dlq, oldestPending, locksTimedOut, attempts] = await Promise.all([
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'FAILED'),
    supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('event_queue').select('created_at').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('consumer_locks').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING').lt('lease_expires_at', new Date().toISOString()),
    supabase.from('event_attempts').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const oldestCreatedAt = oldestPending.data?.created_at ? new Date(oldestPending.data.created_at).getTime() : null;
  const oldestPendingAgeSeconds = oldestCreatedAt ? Math.max(0, Math.round((now - oldestCreatedAt) / 1000)) : 0;

  const errors = [
    pending.error,
    processing.error,
    failed.error,
    dlq.error,
    oldestPending.error,
    locksTimedOut.error,
    attempts.error,
  ].filter(Boolean).map((error: any) => error.message);

  return NextResponse.json({
    ok: errors.length === 0,
    worker: 'event_worker',
    pendingEvents: pending.count || 0,
    processingEvents: processing.count || 0,
    failedEvents: failed.count || 0,
    dlqCount: dlq.count || 0,
    oldestPendingAgeSeconds,
    lockTimeoutCount: locksTimedOut.count || 0,
    lastSuccessfulWorkerRun: attempts.data?.finished_at ?? null,
    errors,
    timestamp: new Date().toISOString(),
  }, { status: errors.length === 0 ? 200 : 503 });
}
