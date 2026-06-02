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

    return NextResponse.json({
      eventQueue: await eventQueueStatus(summary),
      consumerLocks: await consumerLocksStatus(summary),
      agentActions,
      ragJobs,
      autopsyJobs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, unavailable: true }, { status: 200 });
  }
}

async function eventQueueStatus(summary: Awaited<ReturnType<typeof EventWorkerService.getHealthSummary>> | null) {
  if (!summary) return { unavailable: true };

  try {
    return {
      pending: summary.pendingEvents,
      processing: summary.processingEvents,
      completed24h: await countRows('event_queue', (query) => query.eq('status', 'COMPLETED').gte('updated_at', since24h())),
      failed: summary.failedEvents,
      deadLetter: summary.dlqCount,
      oldestPendingAgeSeconds: summary.oldestPendingAgeSeconds || null,
    };
  } catch {
    return { unavailable: true };
  }
}

async function consumerLocksStatus(summary: Awaited<ReturnType<typeof EventWorkerService.getHealthSummary>> | null) {
  if (!summary) return { unavailable: true };

  try {
    return {
      pending: summary.pendingLocks,
      processing: summary.processingLocks,
      completed24h: await countRows('consumer_locks', (query) => query.eq('status', 'COMPLETED').gte('updated_at', since24h())),
      failed: summary.failedLocks,
    };
  } catch {
    return { unavailable: true };
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
