'use client';

import { Activity, BrainCircuit, DatabaseZap } from 'lucide-react';
import Card from '@/components/ui/Card';
import Link from 'next/link';

export default function AmauraMemoryPanel({ memories }: { memories: any[] }) {
  if (memories.length === 0) return null;

  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-3)', backgroundColor: 'var(--bg-card-elevated)', border: '1px solid var(--accent-purple-alpha)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DatabaseZap size={16} color="var(--accent-purple)" />
        <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, margin: 0, color: 'var(--accent-purple)' }}>Learning Memory</h4>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', margin: 0 }}>
        Cognition remembered these weak areas to personalize your upcoming sessions:
      </p>
      {memories.map((memory) => (
        <div key={memory.id ?? memory.pattern} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-2)' }}>
          <strong style={{ fontSize: 'var(--fs-sm)' }}>{memory.topic || memory.subject || memory.pattern_type || memory.memory_type}</strong>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', margin: '3px 0 0' }}>{memory.pattern}</p>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--sp-2)' }}>
        <Link href="/dashboard" style={{ flex: 1 }}>
          <button style={{ width: '100%', padding: '6px 12px', fontSize: 'var(--fs-xs)', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Activity size={14} /> Review Cards
          </button>
        </Link>
        <Link href="/chat" style={{ flex: 1 }}>
          <button style={{ width: '100%', padding: '6px 12px', fontSize: 'var(--fs-xs)', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <BrainCircuit size={14} /> Ask MIND
          </button>
        </Link>
      </div>
    </Card>
  );
}
