import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-root)', padding: 'var(--sp-4)' }}>
      <Card padding="lg" style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', marginBottom: 'var(--sp-2)' }}>Page Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
          That page is not available.
        </p>
        <Link href="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
