import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authError = validateCronRequest(req as any);
  if (authError) return authError;

  const supabase = createAdminClient();
  const [
    queuePending,
    queueFailed,
    dlq,
    runsRunning,
    runsFailed,
    runsCompleted,
    pendingApprovals,
    ragQueued,
    ragFailed,
    autopsyPending,
    autopsyFailed,
    recentFailures,
  ] = await Promise.all([
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'PARTIAL_FAILED']),
    supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('agent_runs').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase.from('agent_runs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('agent_runs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('agent_actions').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabase.from('rag_ingestion_jobs').select('*', { count: 'exact', head: true }).in('status', ['queued', 'extracting', 'chunking', 'embedding']),
    supabase.from('rag_ingestion_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).in('status', ['pending', 'processing', 'needs_user_input']),
    supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase
      .from('agent_runs')
      .select('id, agent_name, error, error_code, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const errors = [
    queuePending.error,
    queueFailed.error,
    dlq.error,
    runsRunning.error,
    runsFailed.error,
    runsCompleted.error,
    pendingApprovals.error,
    ragQueued.error,
    ragFailed.error,
    autopsyPending.error,
    autopsyFailed.error,
    recentFailures.error,
  ].filter(Boolean).map((error: any) => error.message);

  return NextResponse.json({
    ok: errors.length === 0,
    queue: {
      pending: queuePending.count || 0,
      failed: queueFailed.count || 0,
      dlq: dlq.count || 0,
    },
    agentRuns: {
      running: runsRunning.count || 0,
      failed: runsFailed.count || 0,
      completed: runsCompleted.count || 0,
    },
    pendingApprovals: pendingApprovals.count || 0,
    ragJobs: {
      active: ragQueued.count || 0,
      failed: ragFailed.count || 0,
    },
    autopsyJobs: {
      active: autopsyPending.count || 0,
      failed: autopsyFailed.count || 0,
    },
    recentWorkerFailures: recentFailures.data || [],
    errors,
    timestamp: new Date().toISOString(),
  }, { status: errors.length === 0 ? 200 : 503 });
}
