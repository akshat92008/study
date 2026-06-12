'use client';

import { ClipboardList } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function AssessmentCreateStep({
  title,
  assessmentType,
  onTitleChange,
  onTypeChange,
}: {
  title: string;
  assessmentType: string;
  onTitleChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}) {
  return (
    <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Badge color="purple">Step 1</Badge>
        <ClipboardList size={18} color="var(--accent-cyan)" />
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, margin: 0 }}>Deep Autopsy</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(180px, 0.6fr)', gap: 'var(--sp-3)' }}>
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Assessment title"
          style={inputStyle}
        />
        <select value={assessmentType} onChange={(event) => onTypeChange(event.target.value)} style={inputStyle}>
          <option value="custom">Custom</option>
          <option value="mock_test">Full assessment</option>
          <option value="practice_test">Practice test</option>
          <option value="worksheet">Worksheet</option>
          <option value="assignment">Assignment</option>
          <option value="quiz">Quiz</option>
          <option value="past_paper">Past paper</option>
          <option value="self_reflection">Self-reflection</option>
        </select>
      </div>
    </Card>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  fontSize: 'var(--fs-sm)',
};
