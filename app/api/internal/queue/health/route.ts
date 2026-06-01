import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = validateCronRequest(req as any);
  if (authError) return authError;

  const supabase = createAdminClient();
  const [pending, processing, failed, dlq, consumerLag, autopsyQueued, autopsyProcessing, autopsyFailed] = await Promise.all([
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'FAILED'),
    supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    supabase
      .from('consumer_locks')
      .select('consumer_name, created_at')
      .in('status', ['PENDING', 'RETRY_SCHEDULED'])
      .order('created_at', { ascending: true })
      .limit(100),
    supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
    supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);

  const errors = [pending.error, processing.error, failed.error, dlq.error, consumerLag.error, autopsyQueued.error, autopsyProcessing.error, autopsyFailed.error]
    .filter(Boolean)
    .map((error: any) => error.message);

  const lagByConsumer = (consumerLag.data || []).reduce((acc: Record<string, number>, lock: any) => {
    const age = Math.max(0, Math.round((Date.now() - new Date(lock.created_at).getTime()) / 1000));
    acc[lock.consumer_name] = Math.max(acc[lock.consumer_name] || 0, age);
    return acc;
  }, {});

  return NextResponse.json({
    ok: errors.length === 0,
    pendingEvents: pending.count || 0,
    processingEvents: processing.count || 0,
    failedEvents: failed.count || 0,
    dlqCount: dlq.count || 0,
    autopsyJobs: {
      queued: autopsyQueued.count || 0,
      processing: autopsyProcessing.count || 0,
      failed: autopsyFailed.count || 0,
    },
    consumerLagSeconds: lagByConsumer,
    errors,
    timestamp: new Date().toISOString(),
  }, { status: errors.length === 0 ? 200 : 503 });
}
