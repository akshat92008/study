import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { EventWorkerService } from '@/lib/events/worker';
import { SAFE_BOUNDED_CONSUMERS } from '@/lib/amaura/events/event-matrix';

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
    const agentRuntime = await loadAgentRuntimeObservability(supabase);

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
      agentRuntime,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, unavailable: true }, { status: 200 });
  }
}

async function loadAgentRuntimeObservability(supabase: ReturnType<typeof createAdminClient>) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const safeConsumers = [...SAFE_BOUNDED_CONSUMERS];

  const [
    runs,
    failures,
    aiEvents,
    attempts,
    notifications,
    safeFailedJobs,
    cascadeCompleted,
    cascadeFailed,
  ] = await Promise.all([
    supabase
      .from('amaura_agent_runs')
      .select('id, status, agent_name, created_at')
      .gte('created_at', since24h)
      .limit(1000),
    supabase
      .from('amaura_agent_runs')
      .select('agent_name, error')
      .eq('status', 'failed')
      .gte('created_at', since24h)
      .limit(500),
    supabase
      .from('ai_usage_events')
      .select('user_id, feature, prompt_family, prompt_tokens, completion_tokens, created_at')
      .gte('created_at', since24h)
      .limit(1000),
    supabase
      .from('event_attempts')
      .select('consumer_name, started_at, finished_at')
      .not('finished_at', 'is', null)
      .gte('started_at', since24h)
      .limit(1000),
    supabase
      .from('amaura_notifications')
      .select('id, type, read, dedup_key, created_at')
      .gte('created_at', since24h)
      .limit(1000),
    supabase
      .from('consumer_locks')
      .select('id', { count: 'exact', head: true })
      .in('consumer_name', safeConsumers)
      .in('status', ['FAILED', 'DLQ', 'RETRY_SCHEDULED']),
    supabase
      .from('amaura_agent_runs')
      .select('id', { count: 'exact', head: true })
      .eq('agent_name', 'AutopsyCascadeAgent')
      .eq('status', 'completed')
      .gte('created_at', since24h),
    supabase
      .from('amaura_agent_runs')
      .select('id', { count: 'exact', head: true })
      .eq('agent_name', 'AutopsyCascadeAgent')
      .eq('status', 'failed')
      .gte('created_at', since24h),
  ]);

  const runRows = runs.data ?? [];
  const failureRows = failures.data ?? [];
  const aiRows = aiEvents.data ?? [];
  const attemptRows = attempts.data ?? [];
  const notificationRows = notifications.data ?? [];

  const failuresByAgent = countBy(failureRows, (row: any) => row.agent_name ?? 'unknown');
  const aiCallsByAgent = countBy(aiRows.filter((row: any) => row.feature === 'amaura_agent'), (row: any) => row.prompt_family ?? 'amaura_agent');
  const aiCallsByUser = countBy(aiRows.filter((row: any) => row.feature === 'amaura_agent'), (row: any) => row.user_id ?? 'unknown');
  const processingDurations = attemptRows
    .map((row: any) => row.started_at && row.finished_at
      ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
      : 0)
    .filter((duration: number) => duration > 0);
  const averageWorkerProcessingMs = processingDurations.length
    ? Math.round(processingDurations.reduce((sum: number, value: number) => sum + value, 0) / processingDurations.length)
    : 0;
  const notificationDeduped = notificationRows.filter((row: any) => row.dedup_key).length;
  const notificationUnread = notificationRows.filter((row: any) => !row.read).length;
  const cascadeTotal = (cascadeCompleted.count ?? 0) + (cascadeFailed.count ?? 0);

  return {
    runCounts: {
      total24h: runRows.length,
      running24h: runRows.filter((row: any) => row.status === 'running').length,
      completed24h: runRows.filter((row: any) => row.status === 'completed').length,
      skipped24h: runRows.filter((row: any) => row.status === 'skipped').length,
      failed24h: runRows.filter((row: any) => row.status === 'failed').length,
    },
    failuresByAgent,
    aiCallsByAgent,
    aiCallsByUser,
    worker: {
      averageProcessingMs: averageWorkerProcessingMs,
      attempts24h: attemptRows.length,
    },
    autopsyCascade: {
      completed24h: cascadeCompleted.count ?? 0,
      failed24h: cascadeFailed.count ?? 0,
      successRate: cascadeTotal > 0 ? Math.round(((cascadeCompleted.count ?? 0) / cascadeTotal) * 100) : 100,
    },
    notifications: {
      created24h: notificationRows.length,
      unread24h: notificationUnread,
      withDedupKey24h: notificationDeduped,
      byType: countBy(notificationRows, (row: any) => row.type ?? 'unknown'),
    },
    retrySafeFailedJobs: safeFailedJobs.count ?? 0,
    errors: [
      runs.error,
      failures.error,
      aiEvents.error,
      attempts.error,
      notifications.error,
      safeFailedJobs.error,
      cascadeCompleted.error,
      cascadeFailed.error,
    ].filter(Boolean).map((error: any) => error.message),
  };
}

function countBy(rows: any[], key: (row: any) => string) {
  return rows.reduce((acc: Record<string, number>, row: any) => {
    const name = key(row);
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
}
