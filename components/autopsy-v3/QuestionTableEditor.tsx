'use client';

import { Save, Loader2, Table } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function QuestionTableEditor({
  csvText,
  onChange,
  onSave,
  saving,
}: {
  csvText: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Badge color="purple">Step 2</Badge>
        <Table size={18} color="var(--accent-purple)" />
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, margin: 0 }}>Manual CSV (Fallback)</h3>
      </div>
      <textarea
        value={csvText}
        onChange={(event) => onChange(event.target.value)}
        rows={9}
        spellCheck={false}
        placeholder="question_number,subject,topic,correct_answer,user_answer"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          resize: 'vertical',
        }}
      />
      <button onClick={onSave} disabled={saving} style={buttonStyle}>
        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        {saving ? 'Saving...' : 'Save Questions'}
      </button>
    </Card>
  );
}

const buttonStyle: React.CSSProperties = {
  justifySelf: 'start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-cyan)',
  color: 'var(--text-inverse)',
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
};
