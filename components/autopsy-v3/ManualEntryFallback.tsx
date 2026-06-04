'use client';

import { AlertTriangle, Edit3 } from 'lucide-react';

export default function ManualEntryFallback({ message }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      border: '1px solid var(--warning-border, #f5c2c7)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--sp-4)',
      color: 'var(--text-secondary)',
      background: 'var(--warning-bg, rgba(248, 215, 218, 0.1))',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--warning, #856404)' }}>
        <AlertTriangle size={18} />
        <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{message || 'PDF Extraction Degraded'}</span>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
        To keep costs low during the beta, automated extraction is limited. Don't worry—you can easily proceed by pasting your data or manually filling out the table.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent-blue)' }}>
        <Edit3 size={14} />
        <span>Use the Question Editor to continue &rarr;</span>
      </div>
    </div>
  );
}
