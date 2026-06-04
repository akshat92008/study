'use client';

import { Keyboard } from 'lucide-react';

export default function ManualEntryFallback({ message }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--sp-3)',
      color: 'var(--text-secondary)',
      background: 'var(--bg-glass)',
    }}>
      <Keyboard size={16} color="var(--warning)" />
      <span style={{ fontSize: 'var(--fs-sm)' }}>{message || 'We could not reliably read this PDF. You can still continue with manual entry.'}</span>
    </div>
  );
}
