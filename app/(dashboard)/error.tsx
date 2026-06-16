'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '2rem', background: '#ef4444', color: 'white', minHeight: '100vh', zIndex: 9999, position: 'relative' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>DASHBOARD CRASHED</h1>
      <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>{error?.message || "Unknown error"}</p>
      <pre style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.5)', overflow: 'auto' }}>
        {error?.stack}
      </pre>
      <button 
        onClick={() => reset()}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'white', color: 'black', borderRadius: '4px' }}
      >
        Try again
      </button>
    </div>
  );
}
