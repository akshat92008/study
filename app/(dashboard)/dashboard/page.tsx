'use client';

import { useState, useEffect } from 'react';
import CommandCenter from '@/components/dashboard/CommandCenter';
import Card from '@/components/ui/Card';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        {/* Header Skeleton */}
        <div>
          <div style={{ width: 250, height: 32, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }} />
          <div style={{ width: 400, height: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }} />
        </div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
          {[1, 2, 3, 4].map(i => (
            <Card key={i} variant={i === 1 ? 'glow' : 'default'} style={{ height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 80, height: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
              <div style={{ width: 120, height: 28, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }} />
            </Card>
          ))}
        </div>

        {/* Detail Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-6)' }}>
          <Card style={{ height: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 150, height: 20, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-tertiary)' }} />
                <div style={{ flex: 1, height: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
              </div>
            ))}
          </Card>
          <Card style={{ height: 350, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 150, height: 20, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
            {[1, 2, 3, 4].map(j => (
              <div key={j} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-tertiary)' }} />
                <div style={{ flex: 1, height: 16, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }} />
              </div>
            ))}
          </Card>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <CommandCenter
      profile={data.profile}
      cognition={data.cognition}
      revision={data.revision}
      mistakes={data.mistakes}
      tasks={data.tasks || []}
    />
  );
}
