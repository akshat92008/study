'use client';

import { KeyRound } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function AnswerKeyInput({
  value,
  onChange,
  onParse,
}: {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
}) {
  return (
    <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Badge color="purple">Step 3</Badge>
        <KeyRound size={18} color="var(--warning)" />
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, margin: 0 }}>Answer Key</h3>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder="1 A&#10;2 C&#10;3 B"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: 12,
          fontSize: 'var(--fs-sm)',
        }}
      />
      <button onClick={onParse} style={buttonStyle}>Apply Key</button>
    </Card>
  );
}

const buttonStyle: React.CSSProperties = {
  justifySelf: 'start',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
};
