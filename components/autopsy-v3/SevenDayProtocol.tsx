'use client';

import Card from '@/components/ui/Card';

export default function SevenDayProtocol({ days }: { days: any[] }) {
  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, margin: 0 }}>7-Day Protocol</h4>
      <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {days.map((day) => (
          <div key={day.day} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, alignItems: 'start' }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-primary)', display: 'grid', placeItems: 'center', fontWeight: 900, color: 'var(--accent-blue)' }}>{day.day}</span>
            <div>
              <strong style={{ fontSize: 'var(--fs-sm)' }}>{day.title}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', margin: '2px 0 0' }}>{day.action}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
