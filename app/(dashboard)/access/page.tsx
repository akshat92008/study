import { createClient } from '@/lib/supabase/server';
import { getUserAccessState } from '@/lib/access/beta-access';
import { getPlanLimits } from '@/lib/billing/plan-limits';
import { getUserUsageSnapshot } from '@/lib/usage/enforce-feature-limit';
import { CreditCard, Check, ArrowRight, Activity, ShieldAlert, Zap } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = percentage >= 80;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid var(--border-subtle)', padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <strong>{used} / {limit > 0 ? limit : '∞'}</strong>
      </div>
      {limit > 0 && (
        <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
          <div style={{ 
            height: '100%', 
            width: `${percentage}%`, 
            background: isNearLimit ? 'var(--status-error)' : 'var(--accent-cyan)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}
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

  const isFree = access.plan === 'free';
  const isPaid = access.plan === 'pro' || access.plan === 'founding';

  return (
    <main style={{ padding: 'var(--sp-6)', maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 'var(--sp-6)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Plan & Usage</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 'var(--fs-md)' }}>
            Manage your Cognition OS subscription and track your daily usage.
          </p>
        </div>
        {isPaid && (
          <form action="/api/billing/portal" method="POST">
            <button 
              type="submit"
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', background: 'var(--bg-tertiary)', 
                border: '1px solid var(--border-default)', borderRadius: '6px',
                color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer',
                fontSize: 'var(--fs-sm)'
              }}
            >
              <CreditCard size={16} /> Manage Billing
            </button>
          </form>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--sp-6)' }}>
        
        {/* Left Column: Pricing / Plans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          {access.blockedReason && (
            <div style={{ background: 'var(--status-error-bg)', color: 'var(--status-error)', padding: 'var(--sp-4)', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Access Blocked</strong>
                {access.blockedReason}
              </div>
            </div>
          )}

          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, margin: 0 }}>Available Plans</h2>
          
          <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            
            {/* Free Tier */}
            <div style={{ 
              border: isFree ? '2px solid var(--accent-cyan)' : '1px solid var(--border-default)', 
              borderRadius: '12px', padding: 'var(--sp-5)', background: 'var(--bg-elevated)',
              position: 'relative'
            }}>
              {isFree && <div style={{ position: 'absolute', top: -12, left: 20, background: 'var(--accent-cyan)', color: 'var(--bg-primary)', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Current Plan</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--fs-lg)', margin: 0 }}>Free</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 4 }}>Basic access to the AI tutor.</p>
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>$0<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 400 }}>/mo</span></div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="var(--accent-cyan)" /> 3 Daily AI Chat Messages</li>
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="var(--accent-cyan)" /> 1 Assessment Upload</li>
              </ul>
            </div>

            {/* Pro Tier */}
            <div style={{ 
              border: access.plan === 'pro' ? '2px solid var(--accent-purple)' : '1px solid var(--border-default)', 
              borderRadius: '12px', padding: 'var(--sp-5)', background: 'var(--bg-elevated)',
              position: 'relative'
            }}>
              {access.plan === 'pro' && <div style={{ position: 'absolute', top: -12, left: 20, background: 'var(--accent-purple)', color: '#fff', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Current Plan</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 'var(--fs-lg)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>Pro <Zap size={16} color="var(--accent-purple)" /></h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 4 }}>Unleash the full power of Cognition OS.</p>
                </div>
                <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800 }}>$20<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 400 }}>/mo</span></div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 24px 0', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="var(--accent-purple)" /> 80 Daily AI Chat Messages</li>
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="var(--accent-purple)" /> Deep Autopsy Reports & NotebookLM Sources</li>
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="var(--accent-purple)" /> Unlimited Daily Revisions</li>
                <li style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} color="var(--accent-purple)" /> Priority Agent Execution Queue</li>
              </ul>
              
              {access.plan !== 'pro' && (
                <form action="/api/billing/checkout" method="POST">
                  <input type="hidden" name="priceId" value="pro_monthly" />
                  <button type="submit" style={{ 
                    width: '100%', padding: '12px', background: 'var(--accent-purple)', color: '#fff', 
                    border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                  }}>
                    Upgrade to Pro <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
            
          </div>
        </div>

        {/* Right Column: Usage Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ border: '1px solid var(--border-default)', borderRadius: '12px', padding: 'var(--sp-5)', background: 'var(--bg-elevated)' }}>
            <h2 style={{ fontSize: 'var(--fs-lg)', margin: '0 0 var(--sp-4) 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--accent-cyan)" /> Today's Usage
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <UsageRow label="Chat Messages" used={used('chat_message')} limit={limits.dailyChatMessages} />
              <UsageRow label="Amaura AI Decisions" used={used('ai_call')} limit={limits.dailyAiCalls} />
              <UsageRow label="Deep Autopsies" used={used('autopsy_report')} limit={limits.dailyAutopsyReports} />
              <UsageRow label="Document Uploads" used={used('rag_upload') + used('material_upload') + used('autopsy_upload')} limit={limits.dailyRagUploads} />
              <UsageRow label="Knowledge Queries" used={used('material_query')} limit={limits.dailyMaterialQueries} />
              <UsageRow label="Memory Card Generations" used={used('revision_generation')} limit={limits.dailyRevisionGenerations} />
              <UsageRow label="Learner State Mutations" used={used('hermes_write')} limit={limits.dailyHermesWrites} />
            </div>
            
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 'var(--sp-4)', textAlign: 'center' }}>
              Usage resets daily at midnight UTC.
            </p>
          </div>
          
          <div style={{ border: '1px solid var(--border-default)', borderRadius: '12px', padding: 'var(--sp-5)', background: 'var(--bg-tertiary)', fontSize: 'var(--fs-sm)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 'var(--fs-md)' }}>Need Help?</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
              If you have any questions about your billing, limits, or need to cancel your plan, our team is here to assist.
            </p>
            <Link href="/support" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 500 }}>Contact Support →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
