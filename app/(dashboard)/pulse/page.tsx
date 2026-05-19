import { createClient } from '@/lib/supabase/server';
import { detectStudyFriction, getAdaptiveConfig } from '@/lib/engines/pulse-engine';
import PulseDashboard from '@/components/pulse/PulseDashboard';
import { redirect } from 'next/navigation';

export default async function PulsePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { state, confidence } = await detectStudyFriction(user.id);
  const config = getAdaptiveConfig(state);

  const [signals, snapshots, sessions] = await Promise.all([
    supabase.from('pulse_signals').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(50),
    supabase.from('performance_snapshots').select('*').eq('user_id', user.id).order('date', { ascending: true }).limit(14),
    supabase.from('study_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: true }).limit(14)
  ]);

  const data = {
    state,
    confidence,
    config,
    history: {
      signals: signals.data || [],
      snapshots: snapshots.data || [],
      sessions: sessions.data || []
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 'var(--sp-8)' }}>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)' }}>PULSE Cognitive Center</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
          Mental State Engine tracking cognitive load, focus momentum, and learning friction.
        </p>
      </div>
      <PulseDashboard data={data} />
    </div>
  );
}
