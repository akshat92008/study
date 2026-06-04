import { Microscope } from 'lucide-react';
import NextLink from 'next/link';

export default function MistakesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: 800, margin: '0 auto', paddingTop: 'var(--sp-8)' }}>
      <div style={{ textAlign: 'center', padding: 'var(--sp-12)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
        <Microscope size={48} style={{ opacity: 0.3, margin: '0 auto var(--sp-4)', color: 'var(--text-secondary)' }} />
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>No Mistakes Logged</h2>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-6)' }}>Upload assessments or practice sheets, and your AI tutor will diagnose your mistakes here.</p>
        <NextLink href="/autopsy" style={{
          padding: '12px 24px',
          background: 'var(--danger)',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
          display: 'inline-block'
        }}>
          Upload a Test
        </NextLink>
      </div>
    </div>
  );
}
