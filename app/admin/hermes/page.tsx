import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Card from '@/components/ui/Card';
import { DatabaseZap, Activity, Info } from 'lucide-react';
import { getHermesConfig } from '@/lib/hermes/hermes-config';

export const dynamic = 'force-dynamic';

export default async function HermesAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin?next=/admin/hermes');
  }

  // Validate admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const config = getHermesConfig();
  
  const { data: recentMemories } = await supabase
    .from('hermes_learning_memories')
    .select('id, user_id, concept, pattern, severity, action_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--sp-6) var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--sp-6)' }}>
        <DatabaseZap size={32} color="var(--accent-purple)" />
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, margin: 0 }}>Hermes Lite Debug</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <Card padding="md">
          <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>Phase 1 Configuration</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'grid', gap: '4px' }}>
            <li><strong>Enabled:</strong> {config.enabled ? 'Yes' : 'No'}</li>
            <li><strong>Mode:</strong> {config.mode}</li>
            <li><strong>Autopsy Mode:</strong> {config.autopsyV3Mode}</li>
            <li><strong>Max Context Memories:</strong> {config.maxContextMemories}</li>
            <li><strong>Max Daily Writes:</strong> {config.maxDailyMemoryWritesPerUser}</li>
          </ul>
        </Card>
        
        <Card padding="md">
          <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>Disabled Modules (Phase 1)</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'grid', gap: '4px' }}>
            <li><strong>Agent Loop:</strong> {config.agentLoopEnabled ? 'Yes' : 'No'}</li>
            <li><strong>Coding Sandbox:</strong> {config.codingSandboxEnabled ? 'Yes' : 'No'}</li>
            <li><strong>Source Processing:</strong> {config.sourceProcessingEnabled ? 'Yes' : 'No'}</li>
            <li><strong>Next Action:</strong> {config.nextActionEnabled ? 'Yes' : 'No'}</li>
          </ul>
        </Card>
      </div>

      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 'var(--sp-4)' }}>Recent Memory Writes</h2>
      
      {recentMemories?.length === 0 ? (
        <Card padding="md" style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Info size={24} style={{ margin: '0 auto var(--sp-2)' }} />
          <p>No Hermes memories recorded yet.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          {recentMemories?.map((memory) => (
            <Card key={memory.id} padding="md" style={{ borderLeft: `4px solid ${memory.severity === 'high' ? 'var(--status-error)' : 'var(--accent-purple)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>{memory.concept}</strong>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{new Date(memory.created_at).toLocaleString()} | User: {memory.user_id.slice(0, 8)}...</span>
                </div>
                <div style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-subtle)' }}>
                  {memory.severity.toUpperCase()}
                </div>
              </div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--sp-2)' }}>{memory.pattern}</p>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={12} /> Next action: {memory.action_type}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
