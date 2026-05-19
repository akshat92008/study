'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-root)' }}>
      <Card padding="lg" style={{ textAlign: 'center', border: '1px solid var(--danger-dim)' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', color: 'var(--danger)', marginBottom: 'var(--sp-2)' }}>System Fault</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>{error.message || 'A cognitive sub-routine crashed.'}</p>
        <Button onClick={() => reset()}>Reboot System</Button>
      </Card>
    </div>
  );
}
