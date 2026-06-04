import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { EventWorkerService } from '@/lib/events/worker';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const supabase = createAdminClient();

    // System health & queue basics
    const [systemStatus, queueStatus, aiTelemetry] = await Promise.all([
      // Reuse system status logic (similar to app/api/admin/system/status/route.ts)
      (async () => {
        const [pending, processing, failed, dlq, lastAttempt, oldestPending] = await Promise.all([
          supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
          supabase.from('event_queue').select('*', { count: 'exact', head: true }).eq('status', 'PROCESSING'),
          supabase.from('event_queue').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'DLQ']),
          supabase.from('event_dlq').select('*', { count: 'exact', head: true }).is('resolved_at', null),
          supabase.from('event_attempts').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('event_queue').select('created_at').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        ]);
        return {
          pending: pending.count || 0,
          processing: processing.count || 0,
          failed: failed.count || 0,
          dlq: dlq.count || 0,
          lastWorkerRunAt: lastAttempt.data?.finished_at ?? null,
          oldestPendingAgeSeconds: oldestPending.data?.created_at
            ? Math.max(0, Math.round((Date.now() - new Date(oldestPending.data.created_at).getTime()) / 1000))
            : 0,
        };
      })(),
      // Reuse queue status endpoint (eventQueueStatus)
      (async () => {
        const summary = await EventWorkerService.getHealthSummary().catch(() => null);
        if (!summary) return { unavailable: true };
        return {
          pending: summary.pendingEvents,
          processing: summary.processingEvents,
          failed: summary.failedEvents,
          deadLetter: summary.dlqCount,
        };
      })(),
      // AI telemetry (similar to ai-telemetry/route.ts)
      (async () => {
        const [{ count: totalRequests }, { data: usageStats }, { data: recentErrors }] = await Promise.all([
          supabase.from('ai_usage_events').select('*', { count: 'exact', head: true }),
          supabase.rpc('get_ai_usage_summary_v2'),
          supabase.from('ai_usage_events').select('*').eq('status', 'error').order('created_at', { ascending: false }).limit(20),
        ]);
        return { totalRequests: totalRequests || 0, usageStats: usageStats || {}, recentErrors: recentErrors || [] };
      })(),
    ]);

    // Autopsy stats
    const autopsyStats = await Promise.all([
      supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
      supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('autopsy_jobs').select('*', { count: 'exact', head: true }).eq('status', 'needs_user_input'),
    ]);
    const [autopsyQueued, autopsyProcessing, autopsyFailed, autopsyNeedsInput] = autopsyStats.map(r => r.count || 0);

    // Security metrics (example placeholders)
    const [rateLimitEvents, rejectedUploads, unauthorizedAdminAttempts] = await Promise.all([
      supabase.from('rate_limit_events').select('*', { count: 'exact', head: true }).maybeSingle(),
      supabase.from('upload_events').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('admin_audit').select('*', { count: 'exact', head: true }).eq('action', 'unauthorized_attempt'),
    ]);

    return NextResponse.json({
      systemHealth: {
        version: process.env.npm_package_version || '0.0.0',
        nodeEnv: process.env.NODE_ENV,
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        lastWorkerRunAt: systemStatus.lastWorkerRunAt,
        queueDepth: systemStatus.pending + systemStatus.processing,
        deadLetterCount: systemStatus.dlq,
      },
      queue: {
        pending: queueStatus.pending,
        processing: queueStatus.processing,
        failed: queueStatus.failed,
        deadLetter: queueStatus.deadLetter,
        // The retry and process-next-batch actions are performed via separate admin routes.
      },
      aiUsage: {
        totalRequests: aiTelemetry.totalRequests,
        usageStats: aiTelemetry.usageStats,
        recentErrors: aiTelemetry.recentErrors,
      },
      autopsy: {
        queued: autopsyQueued,
        processing: autopsyProcessing,
        failed: autopsyFailed,
        needsUserInput: autopsyNeedsInput,
        // averageProcessingTime could be computed later.
      },
      security: {
        rateLimitEvents: rateLimitEvents?.count || 0,
        rejectedUploads: rejectedUploads?.count || 0,
        unauthorizedAdminAttempts: unauthorizedAdminAttempts?.count || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, unavailable: true }, { status: 200 });
  }
}
