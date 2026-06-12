'use client';

import { BrainCircuit, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

const OPTIONS = [
  ['concept_gap', 'I did not know the concept'],
  ['memory_gap', 'I forgot the fact/formula'],
  ['silly_error', 'I made a silly mistake'],
  ['misread_question', 'I misread the question'],
  ['poor_elimination', 'I was confused between options'],
  ['time_pressure', 'I ran out of time'],
  ['guessed', 'I guessed'],
  ['unknown', 'I have no idea'],
];

export default function UserReasonStep({
  questions,
  reasons,
  onReasonChange,
  onSave,
  saving,
}: {
  questions: any[];
  reasons: Record<string, { userReasonCategory: string; userReason: string }>;
  onReasonChange: (id: string, value: { userReasonCategory?: string; userReason?: string }) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const targets = questions.filter((question) => ['incorrect', 'skipped', 'unattempted'].includes(question.status));

  return (
    <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Badge color="purple">Step 4</Badge>
        <BrainCircuit size={18} color="var(--accent-purple)" />
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, margin: 0 }}>Why It Went Wrong</h3>
      </div>
      {targets.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No wrong or skipped questions are waiting for reasons.</p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          {targets.map((question) => {
            const reason = reasons[question.id] ?? { userReasonCategory: 'unknown', userReason: '' };
            return (
              <div key={question.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', display: 'grid', gap: 'var(--sp-2)' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800 }}>Q{question.question_number} {question.topic || question.subject || ''}</div>
                <select
                  value={reason.userReasonCategory}
                  onChange={(event) => onReasonChange(question.id, { userReasonCategory: event.target.value })}
                  style={inputStyle}
                >
                  {OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input
                  value={reason.userReason}
                  onChange={(event) => onReasonChange(question.id, { userReason: event.target.value })}
                  placeholder="What exactly happened?"
                  style={inputStyle}
                />
              </div>
            );
          })}
        </div>
      )}
      <button onClick={onSave} disabled={saving || targets.length === 0} style={buttonStyle}>
        {saving && <Loader2 className="animate-spin" size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />}
        {saving ? 'Saving...' : 'Save Reasons'}
      </button>
    </Card>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
};

const buttonStyle: React.CSSProperties = {
  justifySelf: 'start',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-purple)',
  color: 'white',
  padding: '10px 14px',
  fontWeight: 800,
  cursor: 'pointer',
};
