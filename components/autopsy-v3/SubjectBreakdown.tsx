'use client';

import Card from '@/components/ui/Card';

export default function SubjectBreakdown({ subjects }: { subjects: any[] }) {
  return (
    <Card padding="md" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, margin: 0 }}>Subjects</h4>
      {subjects.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', margin: 0 }}>No subject rows yet.</p>
      ) : subjects.map((subject) => (
        <div key={subject.subject} style={rowStyle}>
          <span>{subject.subject}</span>
          <strong>{subject.incorrect + subject.skipped}/{subject.total}</strong>
        </div>
      ))}
    </Card>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 'var(--fs-sm)',
  color: 'var(--text-secondary)',
};
