'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const isConfigError = error.message?.includes('CONFIG ERROR');
  const message = (process.env.NODE_ENV === 'production' && !isConfigError)
    ? 'Something went wrong. Please retry, or come back shortly.'
    : error.message || 'Something went wrong.';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-root)' }}>
      <Card padding="lg" style={{ textAlign: 'center', border: '1px solid var(--danger-dim)' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', color: 'var(--danger)', marginBottom: 'var(--sp-2)' }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>{message}</p>
        <Button onClick={() => reset()}>Retry</Button>
      </Card>
    </div>
  );
}
