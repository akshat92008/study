'use client';

import { Activity, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';

export default function DeepAutopsyCard({ deepAutopsy }: { deepAutopsy?: any }) {
  const router = useRouter();
  const latest = deepAutopsy?.latestAssessment;
  const report = deepAutopsy?.latestReport;
  const memory = deepAutopsy?.topMemory;

  return (
    <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-3)', borderColor: 'var(--accent-cyan-dim)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 900, margin: 0 }}>Deep Autopsy</h3>
        </div>
        <button title="Open Deep Autopsy" onClick={() => router.push('/autopsy/deep')} style={iconButtonStyle}>
          <ArrowRight size={16} />
        </button>
      </div>

      {latest || report || memory ? (
        <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            {latest?.title || 'Latest report'} · {latest?.status || report?.status || 'ready'}
          </p>
          {memory && (
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', fontWeight: 800 }}>Top Pattern</div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', margin: '4px 0 0' }}>{memory.pattern}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)' }}>
            {latest?.status === 'parsing_failed' ? (
              <span style={{ color: 'var(--danger)' }}>Extraction failed. Manual entry required.</span>
            ) : (
              <>
                <span>Recoverable: {Math.round(Number(report?.recoverable_marks_estimate ?? 0) * 10) / 10}</span>
                <span>{report?.summary_text || (Number(report?.recoverable_marks_estimate ?? 0) > 0 ? 'Recovery action ready.' : 'No recovery needed.')}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
          Run your first Deep Autopsy to find why you lose marks.
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/autopsy/deep')} style={primaryButtonStyle}>Run Deep Autopsy</button>
        {latest?.id && (
          <button onClick={() => router.push('/autopsy/deep')} style={secondaryButtonStyle}>View Latest</button>
        )}
      </div>
    </Card>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-cyan)',
  color: 'var(--text-inverse)',
  padding: '10px 12px',
  fontWeight: 900,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  fontWeight: 800,
  cursor: 'pointer',
};
