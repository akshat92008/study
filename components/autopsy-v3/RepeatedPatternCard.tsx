'use client';

import { AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function RepeatedPatternCard({ pattern }: { pattern: any }) {
  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-2)', borderColor: 'var(--warning-dim)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="var(--warning)" />
          <strong style={{ textTransform: 'capitalize' }}>{String(pattern.mistakeType).replace(/_/g, ' ')}</strong>
        </div>
        <span style={{ color: 'var(--warning)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>{pattern.severity}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>{pattern.rootCause}</p>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', margin: 0 }}>{pattern.preventionRule}</p>
    </Card>
  );
}
