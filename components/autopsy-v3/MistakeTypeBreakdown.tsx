'use client';

import Card from '@/components/ui/Card';

export default function MistakeTypeBreakdown({ items }: { items: any[] }) {
  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, margin: 0 }}>Mistake Types</h4>
      {items.length === 0 ? <Empty /> : items.map((item) => (
        <div key={item.mistakeType} style={rowStyle}>
          <span>{String(item.mistakeType).replace(/_/g, ' ')}</span>
          <strong>{item.count}</strong>
        </div>
      ))}
    </Card>
  );
}

function Empty() {
  return <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', margin: 0 }}>No diagnosed mistakes yet.</p>;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 'var(--fs-sm)',
  color: 'var(--text-secondary)',
};
