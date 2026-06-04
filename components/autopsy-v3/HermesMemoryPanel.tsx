'use client';

import { DatabaseZap } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function HermesMemoryPanel({ memories }: { memories: any[] }) {
  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DatabaseZap size={16} color="var(--accent-purple)" />
        <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, margin: 0 }}>Memory</h4>
      </div>
      {memories.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', margin: 0 }}>No memory rows were written for this report.</p>
      ) : memories.map((memory) => (
        <div key={memory.id ?? memory.pattern} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-2)' }}>
          <strong style={{ fontSize: 'var(--fs-sm)' }}>{memory.topic || memory.subject || memory.memory_type}</strong>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', margin: '3px 0 0' }}>{memory.pattern}</p>
        </div>
      ))}
    </Card>
  );
}
