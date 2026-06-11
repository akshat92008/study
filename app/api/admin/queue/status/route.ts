import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { EventWorkerService } from '@/lib/events/worker';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const [summary, agentActions, ragJobs, autopsyJobs] = await Promise.all([
      EventWorkerService.getHealthSummary().catch(() => null),
      countAgentActions(),
      countJobs('rag_ingestion_jobs'),
      countJobs('autopsy_jobs'),
    ]);

    // Flat response shape matched to QueueDashboard component expectations
    const pendingEvents = summary?.pendingEvents ?? 0;
    const processingEvents = summary?.processingEvents ?? 0;
    const failedEvents = summary?.failedEvents ?? 0;
    const dlqCount = summary?.dlqCount ?? 0;
    const oldestPendingAgeSeconds = summary?.oldestPendingAgeSeconds ?? null;
    const processingLocks = summary?.processingLocks ?? 0;
    const failedLocks = summary?.failedLocks ?? 0;
    const pendingLocks = summary?.pendingLocks ?? 0;

    // Compute completed24h counts separately (non-blocking)
    const [completedEventCount, completedLockCount] = await Promise.all([
      countRows('event_queue', (q) => q.eq('status', 'COMPLETED').gte('updated_at', since24h())).catch(() => 0),
      countRows('consumer_locks', (q) => q.eq('status', 'COMPLETED').gte('updated_at', since24h())).catch(() => 0),
    ]);

    // Health signal: flag if queue is unhealthy
    const isHealthy = pendingEvents === 0 || (oldestPendingAgeSeconds !== null && oldestPendingAgeSeconds < 300);
    const hasErrors = failedEvents > 0 || dlqCount > 0;

    return NextResponse.json({
      // Flat fields for QueueDashboard
      pendingEvents,
      processingEvents,
      failedEvents,
      dlqCount,
      oldestPendingAgeSeconds,
      processingLocks,
      failedLocks,
      pendingLocks,
      completedEvents24h: completedEventCount,
      completedLocks24h: completedLockCount,
      isHealthy,
      hasErrors,
      workerAvailable: summary !== null,

      // Nested details for future admin features
      agentActions,
      ragJobs,
      autopsyJobs,
    });
  } catch (err: any) {
    return NextResponse.json({
      // Return zeroed flat shape so UI doesn't show undefined
      pendingEvents: 0,
      processingEvents: 0,
      failedEvents: 0,
      dlqCount: 0,
      oldestPendingAgeSeconds: null,
      processingLocks: 0,
      failedLocks: 0,
      pendingLocks: 0,
      completedEvents24h: 0,
      completedLocks24h: 0,
      isHealthy: false,
      hasErrors: true,
      workerAvailable: false,
      error: err.message,
      unavailable: true,
    }, { status: 200 });
  }
}

async function countAgentActions() {
  try {
    return {
      applied24h: await countRows('agent_actions', (query) => query.eq('status', 'applied').gte('updated_at', since24h())),
      proposed: await countRows('agent_actions', (query) => query.or('status.eq.proposed,status.eq.pending_approval,approval_status.eq.pending')),
      failed: await countRows('agent_actions', (query) => query.eq('status', 'failed')),
      skipped24h: await countRows('agent_actions', (query) => query.eq('status', 'skipped').gte('updated_at', since24h())),
    };
  } catch {
    return { unavailable: true };
  }
}

async function countJobs(table: string) {
  try {
    return {
      queued: await countRows(table, (query) => query.in('status', ['queued', 'uploaded'])),
      processing: await countRows(table, (query) => query.in('status', ['processing', 'extracting', 'chunking', 'embedding'])),
      failed: await countRows(table, (query) => query.eq('status', 'failed')),
    };
  } catch {
    return { unavailable: true };
  }
}

async function countRows(table: string, build: (query: any) => any) {
  const supabase = createAdminClient();
  const query = build(supabase.from(table).select('*', { count: 'exact', head: true }));
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function since24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
