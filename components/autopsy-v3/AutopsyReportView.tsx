'use client';

import SubjectBreakdown from './SubjectBreakdown';
import MistakeTypeBreakdown from './MistakeTypeBreakdown';
import RepeatedPatternCard from './RepeatedPatternCard';
import RecoverableMarksCard from './RecoverableMarksCard';
import SevenDayProtocol from './SevenDayProtocol';
import HermesMemoryPanel from './HermesMemoryPanel';

export default function AutopsyReportView({ report, memories }: { report: any; memories: any[] }) {
  const body = report?.report_json ?? report;
  if (!body) return null;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <section style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, margin: 0 }}>{body.overview?.title || 'Deep Autopsy Report'}</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{body.summaryText}</p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-3)' }}>
        <Metric label="Correct" value={body.overview?.correct ?? 0} />
        <Metric label="Incorrect" value={body.overview?.incorrect ?? 0} />
        <Metric label="Skipped" value={body.overview?.skipped ?? 0} />
        <RecoverableMarksCard estimate={body.recoverableMarks} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-3)' }}>
        <SubjectBreakdown subjects={body.subjectBreakdown ?? []} />
        <MistakeTypeBreakdown items={body.mistakeTypeBreakdown ?? []} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 900, margin: 0 }}>Patterns</h3>
        {(body.repeatedPatterns ?? []).length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', margin: 0 }}>No repeated pattern crossed the confidence threshold yet.</p>
        ) : body.repeatedPatterns.slice(0, 4).map((pattern: any) => (
          <RepeatedPatternCard key={pattern.key} pattern={pattern} />
        ))}
      </div>

      <SevenDayProtocol days={body.sevenDayProtocol ?? []} />
      <HermesMemoryPanel memories={memories} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-secondary)',
      padding: 'var(--sp-4)',
    }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-xl)', fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}
