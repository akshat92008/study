import { Calendar } from 'lucide-react';
import NextLink from 'next/link';

export default function PlannerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: 800, margin: '0 auto', paddingTop: 'var(--sp-8)' }}>
      <div style={{ textAlign: 'center', padding: 'var(--sp-12)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
        <Calendar size={48} style={{ opacity: 0.3, margin: '0 auto var(--sp-4)', color: 'var(--text-secondary)' }} />
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Study Planner Empty</h2>
        <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-6)' }}>Your AI-generated daily study plans will appear here once you start your learning journey.</p>
        <NextLink href="/dashboard" style={{
          padding: '12px 24px',
          background: 'var(--accent-blue)',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 600,
          display: 'inline-block'
        }}>
          Go to Dashboard
        </NextLink>
      </div>
    </div>
  );
}
