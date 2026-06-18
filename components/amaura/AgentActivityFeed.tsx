'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import styles from './AgentActivityFeed.module.css'; // We'll create this or use inline styles

type AgentAction = {
  id: string;
  agent_name: string;
  action_type: string;
  title?: string;
  status: 'applied' | 'skipped' | 'failed';
  reason?: string;
  target_type?: string;
  target_id?: string;
  created_at: string;
  evidence?: any;
  error?: string | null;
  error_code?: string | null;
};

export function AgentActivityFeed() {
  const [activities, setActivities] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/amaura/activity?limit=10', { cache: 'no-store' });
      if (!res.ok) throw new Error('Amaura activity is temporarily unavailable.');
      const data = await res.json();
      setActivities(data.activity || []);
      setError(null);
    } catch (e) {
      console.error('Failed to fetch agent activity', e);
      setError(e instanceof Error ? e.message : 'Unable to load Amaura activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 15000); // Polling every 15s for demo
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const getAgentLabel = (activity: AgentAction) => {
    if (activity.title) return activity.title;
    const subsystem: Record<string, string> = {
      mind: 'Cognition Engine',
      atlas: 'Progress Engine',
      autopsy: 'Autopsy Engine',
      memory: 'Memory Engine',
      planner: 'Mission Planner',
      command: 'Mission Planner',
      system: 'Cognition Engine',
    };
    return `${subsystem[activity.agent_name] ?? 'Cognition Engine'}: ${activity.action_type.replace(/_/g, ' ')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied': return <CheckCircle2 size={16} color="var(--success-500, #10b981)" />;
      case 'skipped': return <AlertCircle size={16} color="var(--warning-500, #f59e0b)" />;
      case 'failed': return <XCircle size={16} color="var(--danger-500, #ef4444)" />;
      default: return <Activity size={16} />;
    }
  };

  if (loading && activities.length === 0) {
    return <div style={{ padding: 16, color: 'var(--text-secondary)' }}><Loader2 className="animate-spin" size={16}/> Loading Cognition OS activity...</div>;
  }

  return (
    <div style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: '8px',
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '400px'
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="var(--accent-primary, #8b5cf6)" />
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Cognition OS Activity</h3>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Real learner-state changes</span>
      </div>


      <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
        {error ? (
          <div role="alert" style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--danger)', fontSize: '13px' }}>
            {error}
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            Cognition OS activity will appear after you study, practice, or upload a test.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activities.map((activity, index) => (
              <li key={activity.id} className={styles.activityItem} style={{
                padding: '12px',
                borderRadius: '6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13px',
                animationDelay: `${index * 0.05}s`,
                boxShadow: activity.status === 'applied' ? '0 0 8px rgba(139, 92, 246, 0.05)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ marginTop: 2 }}>{getStatusIcon(activity.status)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '12px', letterSpacing: '0.01em' }}>
                        {getAgentLabel(activity)}
                      </strong>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', opacity: 0.8 }}>
                        {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {activity.reason && (
                      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.4, fontSize: '12px' }}>
                        {activity.reason}
                      </p>
                    )}
                    {(activity.target_type || activity.error_code) && (
                      <div style={{ marginTop: 6, color: activity.status === 'failed' ? 'var(--danger)' : 'var(--text-tertiary)', fontSize: '10px' }}>
                        {activity.target_type ? `Target: ${activity.target_type}` : ''}
                        {activity.error_code ? ` Failure: ${activity.error_code}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
