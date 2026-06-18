'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-root, #0a0a0d)',
      color: 'var(--text-primary, #e2e8f0)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        alignItems: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          ⚠️
        </div>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: 0,
        }}>
          Dashboard ran into an issue
        </h1>
        <p style={{
          color: 'var(--text-secondary, #94a3b8)',
          fontSize: '0.875rem',
          lineHeight: 1.5,
          margin: 0,
        }}>
          Something went wrong loading this page. Your data is safe — try refreshing.
          {error?.digest && (
            <span style={{ display: 'block', marginTop: 8, fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)' }}>
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-blue, #3b82f6)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid var(--border-default, #334155)',
              background: 'transparent',
              color: 'var(--text-secondary, #94a3b8)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Reload Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
