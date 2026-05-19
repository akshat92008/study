'use client';

import { useMemo } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Activity, ShieldAlert, Target, Shield, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface PulseDashboardProps {
  data: {
    state: 'focused' | 'neutral' | 'frustrated' | 'overwhelmed';
    confidence: number;
    config: {
      maxDailyTasks: number;
      taskIntensity: string;
      explanationDepth: string;
      workloadMultiplier: number;
      uiMessage: string;
    };
    history: {
      signals: any[];
      snapshots: any[];
      sessions: any[];
    };
  };
}

const STATE_DETAILS: Record<string, { label: string; color: string; bg: string; icon: any; border: string }> = {
  focused: { label: 'High Momentum', color: 'var(--accent-cyan)', bg: 'rgba(0, 240, 255, 0.1)', icon: Target, border: '1px solid var(--accent-cyan)' },
  neutral: { label: 'Steady Focus', color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)', icon: Activity, border: '1px solid var(--border-default)' },
  frustrated: { label: 'High Friction', color: 'var(--warning)', bg: 'var(--warning-dim)', icon: AlertTriangle, border: '1px solid var(--warning)' },
  overwhelmed: { label: 'Cognitive Overload', color: 'var(--danger)', bg: 'var(--danger-dim)', icon: ShieldAlert, border: '1px solid var(--danger)' },
};

export default function PulseDashboard({ data }: PulseDashboardProps) {
  const { state = 'neutral', confidence = 1.0, config, history } = data || {};
  const currentDetails = STATE_DETAILS[state] || STATE_DETAILS.neutral;
  const ActiveIcon = currentDetails.icon;

  // Process timeline data (last 14 days)
  const timeline = useMemo(() => {
    const today = new Date();
    const days: Record<string, { friction: number; count: number }> = {};

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days[d.toISOString().split('T')[0]] = { friction: 0, count: 0 };
    }

    // Map state to friction score: focused=0, neutral=2, frustrated=6, overwhelmed=10
    const stateFriction: Record<string, number> = {
      focused: 0,
      neutral: 2,
      frustrated: 6,
      overwhelmed: 10,
    };

    (history?.signals || []).forEach((sig: any) => {
      const dateKey = new Date(sig.created_at).toISOString().split('T')[0];
      if (days[dateKey] !== undefined) {
        const stateStr = sig.emotional_state || 'neutral';
        days[dateKey].friction += stateFriction[stateStr] ?? 2;
        days[dateKey].count++;
      }
    });

    return Object.entries(days).map(([date, val]) => {
      const avgFriction = val.count > 0 ? Math.round(val.friction / val.count) : 2;
      return {
        date,
        friction: avgFriction,
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
  }, [history?.signals]);

  // Process state distribution
  const stateDistribution = useMemo(() => {
    const dist = { focused: 0, neutral: 0, frustrated: 0, overwhelmed: 0 };
    (history?.signals || []).forEach((sig: any) => {
      const stateStr = sig.emotional_state || 'neutral';
      if (dist[stateStr as keyof typeof dist] !== undefined) {
        dist[stateStr as keyof typeof dist]++;
      }
    });
    return dist;
  }, [history?.signals]);

  // Process trends (session duration vs accuracy)
  const trends = useMemo(() => {
    const list = (history?.snapshots || []).slice(-7).map((s: any) => {
      return {
        date: new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }),
        accuracy: Math.round((s.accuracy || 0) * 100),
        studyMinutes: s.study_minutes || 0,
      };
    });
    return list;
  }, [history?.snapshots]);

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Active State Header Card */}
      <Card variant="glow" style={{ border: currentDetails.border, background: currentDetails.bg, padding: 'var(--sp-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.05)', color: currentDetails.color,
              border: `1px solid ${currentDetails.color}33`
            }}>
              <ActiveIcon size={28} className="animate-pulse" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
                  Active Cognitive State
                </span>
                <Badge color={state === 'overwhelmed' ? 'red' : state === 'frustrated' ? 'yellow' : state === 'focused' ? 'cyan' : 'gray'}>
                  {Math.round(confidence * 100)}% Confidence
                </Badge>
              </div>
              <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: currentDetails.color, marginTop: 2 }}>
                {currentDetails.label}
              </h2>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Adaptive Workload Multiplier</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {config?.workloadMultiplier || 1.0}x
            </div>
          </div>
        </div>

        <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
          <strong>System Action:</strong> {config?.uiMessage}
        </p>
      </Card>

      {/* Grid: Stats and State Distribution */}
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
        {/* State Distribution */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
            <Shield size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
              Telemetry Signals Distribution (Last 50 Events)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {([
              { key: 'focused', label: 'High Momentum', color: 'var(--accent-cyan)', count: stateDistribution.focused },
              { key: 'neutral', label: 'Steady Focus', color: 'var(--text-secondary)', count: stateDistribution.neutral },
              { key: 'frustrated', label: 'High Friction', color: 'var(--warning)', count: stateDistribution.frustrated },
              { key: 'overwhelmed', label: 'Cognitive Overload', color: 'var(--danger)', count: stateDistribution.overwhelmed },
            ] as const).map((item) => {
              const total = Math.max(1, stateDistribution.focused + stateDistribution.neutral + stateDistribution.frustrated + stateDistribution.overwhelmed);
              const pct = Math.round((item.count / total) * 100);

              return (
                <div key={item.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', marginBottom: 4 }}>
                    <span style={{ fontWeight: 'var(--fw-semibold)', color: item.color }}>{item.label}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{item.count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 'var(--radius-full)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Adaptive Parameters */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
            <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
              Current Adaptive Calibration
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Max Daily Tasks</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2 }}>
                {config?.maxDailyTasks}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Task Intensity</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2, textTransform: 'capitalize' }}>
                {config?.taskIntensity}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Explanation Depth</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2, textTransform: 'capitalize' }}>
                {config?.explanationDepth}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Friction Signals Analyzed</div>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2 }}>
                {history?.signals?.length || 0}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Friction score timeline (Last 2 Weeks) */}
      <Card padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <Activity size={16} style={{ color: 'var(--warning)' }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
            Friction Score Timeline (Last 2 Weeks)
          </span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-end', height: 100, padding: 'var(--sp-2) 0' }}>
          {timeline.map((day) => {
            // Max friction is 10
            const height = Math.max(8, (day.friction / 10) * 80);
            let barColor = 'var(--accent-cyan)';
            if (day.friction >= 7) barColor = 'var(--danger)';
            else if (day.friction >= 4) barColor = 'var(--warning)';

            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%',
                  height,
                  background: barColor,
                  borderRadius: 'var(--radius-xs)',
                  opacity: 0.85,
                  transition: 'height 0.3s ease'
                }} title={`${day.date}: Friction Score ${day.friction}/10`} />
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Accuracy & Study Time Trends */}
      {trends.length > 0 && (
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
            <Clock size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
              Weekly Session Duration & Accuracy Trends
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {trends.map((t) => (
              <div key={t.date} style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', gap: 'var(--sp-4)' }}>
                <div style={{ width: 48, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>{t.date}</div>
                <div style={{ flex: 1, display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  {/* Accuracy Bar */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      <span>Accuracy</span>
                      <span>{t.accuracy}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ width: `${t.accuracy}%`, height: '100%', background: 'var(--success)' }} />
                    </div>
                  </div>
                  {/* Duration Bar */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      <span>Study Duration</span>
                      <span>{t.studyMinutes}m</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      {/* Scale max duration to 120m */}
                      <div style={{ width: `${Math.min(100, (t.studyMinutes / 120) * 100)}%`, height: '100%', background: 'var(--accent-blue)' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
