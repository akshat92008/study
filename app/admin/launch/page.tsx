import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFeatureEnabled } from '@/lib/feature-registry';

export const dynamic = 'force-dynamic';

async function countRows(table: string, apply?: (query: any) => any): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  if (apply) query = apply(query);
  const { count } = await query;
  return count ?? 0;
}

function todayIso() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function monthIso() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

async function getLaunchMetrics() {
  const supabase = createAdminClient();
  const today = todayIso();
  const month = monthIso();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsers,
    betaUsers,
    foundingUsers,
    proUsers,
    suspendedUsers,
    usageToday,
    aiMonth,
    pendingQueue,
    processingQueue,
    failedQueue,
    dlq,
    oldestPending,
    criticalErrors,
    topUsage,
    pendingAmauraLocks,
    completedAmauraRuns,
    failedAmauraRuns,
    skippedAmauraRuns,
    lastAmauraFailures,
  ] = await Promise.all([
    countRows('profiles'),
    countRows('profiles', (q) => q.eq('beta_access', true)),
    countRows('profiles', (q) => q.eq('manual_plan', 'founding')),
    countRows('profiles', (q) => q.eq('manual_plan', 'pro')),
    countRows('profiles', (q) => q.eq('suspended', true)),
    supabase.from('feature_usage_events').select('user_id,feature,amount,estimated_cost_usd,created_at').gte('created_at', today),
    supabase
      .from('feature_usage_events')
      .select('estimated_cost_usd')
      .in('feature', ['ai_call', 'worker_ai_call'])
      .gte('created_at', month),
    countRows('event_queue', (q) => q.eq('status', 'PENDING')),
    countRows('event_queue', (q) => q.eq('status', 'PROCESSING')),
    countRows('event_queue', (q) => q.in('status', ['FAILED', 'PARTIAL_FAILED', 'DLQ'])),
    countRows('event_dlq', (q) => q.is('resolved_at', null)),
    supabase.from('event_queue').select('created_at').eq('status', 'PENDING').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    countRows('app_error_events', (q) => q.gte('created_at', today).in('severity', ['error', 'critical'])),
    supabase
      .from('feature_usage_events')
      .select('user_id,amount')
      .gte('created_at', today)
      .limit(500),
    countRows('consumer_locks', (q) => q.eq('status', 'PENDING').like('consumer_name', 'amaura_%')),
    countRows('amaura_agent_runs', (q) => q.eq('status', 'completed')),
    countRows('amaura_agent_runs', (q) => q.eq('status', 'failed')),
    countRows('amaura_agent_runs', (q) => q.eq('status', 'skipped')),
    supabase.from('amaura_agent_runs').select('*').eq('status', 'failed').order('created_at', { ascending: false }).limit(20),
  ]);

  const rows = usageToday.data ?? [];
  const sumFeature = (feature: string) =>
    rows.filter((row: any) => row.feature === feature).reduce((sum: number, row: any) => sum + Number(row.amount ?? 1), 0);
  const aiSpendToday = rows
    .filter((row: any) => row.feature === 'ai_call' || row.feature === 'worker_ai_call')
    .reduce((sum: number, row: any) => sum + Number(row.estimated_cost_usd ?? 0), 0);
  const activeToday = new Set(rows.map((row: any) => row.user_id).filter(Boolean)).size;
  const active7 = await supabase
    .from('feature_usage_events')
    .select('user_id')
    .gte('created_at', since7)
    .limit(1000);
  const topUsers = new Map<string, number>();
  for (const row of topUsage.data ?? []) {
    topUsers.set(row.user_id, (topUsers.get(row.user_id) ?? 0) + Number(row.amount ?? 1));
  }

  return {
    totalUsers,
    betaUsers,
    foundingUsers,
    proUsers,
    suspendedUsers,
    activeToday,
    active7: new Set((active7.data ?? []).map((row: any) => row.user_id).filter(Boolean)).size,
    chatToday: sumFeature('chat_message'),
    aiToday: sumFeature('ai_call') + sumFeature('worker_ai_call'),
    aiSpendToday,
    aiSpendMonth: (aiMonth.data ?? []).reduce((sum: number, row: any) => sum + Number(row.estimated_cost_usd ?? 0), 0),
    reportsToday: sumFeature('autopsy_report'),
    ragUploadsToday: sumFeature('rag_upload') + sumFeature('material_upload'),
    materialQueriesToday: sumFeature('material_query'),
    revisionToday: sumFeature('revision_generation'),
    memoryWritesToday: sumFeature('hermes_write'),
    pendingQueue,
    processingQueue,
    failedQueue,
    dlq,
    oldestPendingAge: oldestPending.data?.created_at
      ? Math.round((Date.now() - new Date(oldestPending.data.created_at).getTime()) / 1000)
      : 0,
    criticalErrors,
    topUsers: Array.from(topUsers.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
    amauraMetrics: {
      pendingLocks: pendingAmauraLocks,
      completedRuns: completedAmauraRuns,
      failedRuns: failedAmauraRuns,
      skippedRuns: skippedAmauraRuns,
      dailyAiCalls: sumFeature('worker_ai_call'),
      lastFailures: lastAmauraFailures.data ?? [],
    },
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #d6dce5', borderRadius: 8, padding: 14, background: '#fff' }}>
      <div style={{ color: '#526071', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#111827', fontSize: 24, fontWeight: 750, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export default async function LaunchDashboardPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin/launch');
  if (auth.status === 403) redirect('/dashboard');

  const metrics = await getLaunchMetrics();
  
  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px', background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>100-User Beta Launch</h1>
        <p style={{ color: '#526071', marginTop: 8 }}>Operational dashboard for manual access, usage, queue health, and kill-switch posture.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Metric label="Total users" value={metrics.totalUsers} />
        <Metric label="Beta access users" value={metrics.betaUsers} />
        <Metric label="Founding users" value={metrics.foundingUsers} />
        <Metric label="Pro users" value={metrics.proUsers} />
        <Metric label="Suspended users" value={metrics.suspendedUsers} />
        <Metric label="Active today" value={metrics.activeToday} />
        <Metric label="Active last 7 days" value={metrics.active7} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Metric label="Chat messages today" value={metrics.chatToday} />
        <Metric label="AI calls today" value={metrics.aiToday} />
        <Metric label="AI spend today" value={`$${metrics.aiSpendToday.toFixed(2)}`} />
        <Metric label="AI spend month" value={`$${metrics.aiSpendMonth.toFixed(2)}`} />
        <Metric label="Autopsy reports today" value={metrics.reportsToday} />
        <Metric label="RAG uploads today" value={metrics.ragUploadsToday} />
        <Metric label="Material queries today" value={metrics.materialQueriesToday} />
        <Metric label="Revision generations today" value={metrics.revisionToday} />
        <Metric label="Memory writes today" value={metrics.memoryWritesToday} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Metric label="Queue pending" value={metrics.pendingQueue} />
        <Metric label="Queue processing" value={metrics.processingQueue} />
        <Metric label="Queue failed" value={metrics.failedQueue} />
        <Metric label="DLQ" value={metrics.dlq} />
        <Metric label="Oldest pending age" value={`${metrics.oldestPendingAge}s`} />
        <Metric label="Errors today" value={metrics.criticalErrors} />
      </section>

      <section style={{ border: '1px solid #d6dce5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Amaura Agent Runtime</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Metric label="Pending Locks" value={metrics.amauraMetrics.pendingLocks} />
          <Metric label="Completed Runs" value={metrics.amauraMetrics.completedRuns} />
          <Metric label="Failed Runs" value={metrics.amauraMetrics.failedRuns} />
          <Metric label="Skipped Runs" value={metrics.amauraMetrics.skippedRuns} />
          <Metric label="Daily AI Calls" value={metrics.amauraMetrics.dailyAiCalls} />
        </div>
        {metrics.amauraMetrics.lastFailures.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, color: '#526071', marginBottom: 8 }}>Last {metrics.amauraMetrics.lastFailures.length} Failures</h3>
            <ul style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: '#334155' }}>
              {metrics.amauraMetrics.lastFailures.map((failure: any) => (
                <li key={failure.id} style={{ marginBottom: 4 }}>
                  <strong>{failure.agent_name}</strong> - {new Date(failure.created_at).toLocaleString()}
                  <br />
                  <span style={{ color: '#ef4444' }}>{failure.error ?? 'Unknown error'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section style={{ border: '1px solid #d6dce5', borderRadius: 8, padding: 16, background: '#fff', marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Kill Switches</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, color: '#334155' }}>
          <div>AI paused: {!isFeatureEnabled('ai_global') ? 'yes' : 'no'}</div>
          <div>RAG uploads: {isFeatureEnabled('rag_upload') ? 'enabled' : 'paused'}</div>
          <div>RAG queries: {isFeatureEnabled('rag_query') ? 'enabled' : 'paused'}</div>
          <div>Autopsy reports: {isFeatureEnabled('autopsy_report') ? 'enabled' : 'paused'}</div>
          <div>Amaura writes: {isFeatureEnabled('hermes_write') ? 'enabled' : 'paused'}</div>
          <div>Worker AI: {isFeatureEnabled('worker_ai') ? 'enabled' : 'off'}</div>
        </div>
      </section>

      <section style={{ border: '1px solid #d6dce5', borderRadius: 8, padding: 16, background: '#fff' }}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Top Usage Users Today</h2>
        {metrics.topUsers.length === 0 ? (
          <p style={{ color: '#526071' }}>No usage events recorded today.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 22 }}>
            {metrics.topUsers.map(([userId, count]) => (
              <li key={userId} style={{ marginBottom: 6 }}>
                <code>{userId}</code> — {count} events
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
