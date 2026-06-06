import { createClient } from '@/lib/supabase/server';
import { getUserAccessState } from '@/lib/access/beta-access';
import { getPlanLimits } from '@/lib/billing/plan-limits';
import { getUserUsageSnapshot } from '@/lib/usage/enforce-feature-limit';

export const dynamic = 'force-dynamic';

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', padding: '10px 0' }}>
      <span>{label}</span>
      <strong>{used} / {limit}</strong>
    </div>
  );
}

export default async function AccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const access = await getUserAccessState(user.id);
  const limits = getPlanLimits(access.plan);
  const usage = await getUserUsageSnapshot(user.id).catch(() => ({ today: [] as any[] }));
  const used = (feature: string) =>
    usage.today
      .filter((row: any) => row.feature === feature && row.status !== 'released')
      .reduce((sum: number, row: any) => sum + Number(row.amount ?? 1), 0);

  return (
    <main style={{ padding: 'var(--sp-6)', maxWidth: 920, margin: '0 auto', display: 'grid', gap: 'var(--sp-5)' }}>
      <header>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, margin: 0 }}>Access</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
          Cognition OS is in controlled beta. Access is manually activated for beta users.
        </p>
      </header>

      <section style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--sp-5)', background: 'var(--bg-elevated)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', marginTop: 0 }}>Current State</h2>
        <div style={{ display: 'grid', gap: 8, color: 'var(--text-secondary)' }}>
          <div>Plan: <strong style={{ color: 'var(--text-primary)' }}>{access.plan}</strong></div>
          <div>Beta access: <strong style={{ color: 'var(--text-primary)' }}>{access.hasBetaAccess ? 'active' : 'not active'}</strong></div>
          <div>Access source: <strong style={{ color: 'var(--text-primary)' }}>{access.accessSource}</strong></div>
          <div>Expiry: <strong style={{ color: 'var(--text-primary)' }}>{access.betaAccessUntil || 'none'}</strong></div>
          {access.blockedReason && (
            <div>Status: <strong style={{ color: 'var(--status-error)' }}>{access.blockedReason}</strong></div>
          )}
        </div>
      </section>

      <section style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--sp-5)', background: 'var(--bg-elevated)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', marginTop: 0 }}>Today</h2>
        <UsageRow label="Chat messages" used={used('chat_message')} limit={limits.dailyChatMessages} />
        <UsageRow label="AI calls" used={used('ai_call')} limit={limits.dailyAiCalls} />
        <UsageRow label="Autopsy reports" used={used('autopsy_report')} limit={limits.dailyAutopsyReports} />
        <UsageRow label="RAG uploads" used={used('rag_upload') + used('material_upload')} limit={limits.dailyRagUploads} />
        <UsageRow label="Material queries" used={used('material_query')} limit={limits.dailyMaterialQueries} />
        <UsageRow label="Amaura writes" used={used('hermes_write')} limit={limits.dailyHermesWrites} />
        <UsageRow label="Revision generations" used={used('revision_generation')} limit={limits.dailyRevisionGenerations} />
      </section>

      <section style={{ border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--sp-5)', background: 'var(--bg-elevated)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', marginTop: 0 }}>Beta Access</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
          Access is manually activated for beta users. Contact admin/support to activate founding access.
        </p>
      </section>
    </main>
  );
}
