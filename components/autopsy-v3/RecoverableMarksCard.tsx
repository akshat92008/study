'use client';

import { Gauge } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function RecoverableMarksCard({ estimate }: { estimate: any }) {
  const total = Number(estimate?.immediately_recoverable ?? 0) + Number(estimate?.short_term_recoverable ?? 0) + Number(estimate?.long_term_recoverable ?? 0);
  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Gauge size={16} color="var(--accent-cyan)" />
        <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, margin: 0 }}>Recoverable</h4>
      </div>
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--accent-cyan)' }}>{Math.round(total * 10) / 10}</div>
      <div style={{ display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)' }}>
        <span>Immediate: {estimate?.immediately_recoverable ?? 0}</span>
        <span>Short term: {estimate?.short_term_recoverable ?? 0}</span>
        <span>Long term: {estimate?.long_term_recoverable ?? 0}</span>
      </div>
    </Card>
  );
}
