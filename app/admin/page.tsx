import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';

export default async function AdminRootPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin');
  if (auth.status === 403) redirect('/dashboard');

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 32, marginBottom: 24 }}>Admin Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        <Link
          href="/admin/users"
          style={{
            padding: 24,
            background: 'white',
            borderRadius: 8,
            border: '1px solid #d6dce5',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 8 }}>Users</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Manage user accounts, plans, and access</p>
        </Link>
        <Link
          href="/admin/queue"
          style={{
            padding: 24,
            background: 'white',
            borderRadius: 8,
            border: '1px solid #d6dce5',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 8 }}>Queue</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Monitor and retry failed background jobs</p>
        </Link>
        <Link
          href="/admin/hermes"
          style={{
            padding: 24,
            background: 'white',
            borderRadius: 8,
            border: '1px solid #d6dce5',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 8 }}>Hermes</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>View and manage Hermes runs</p>
        </Link>
        <Link
          href="/admin/launch"
          style={{
            padding: 24,
            background: 'white',
            borderRadius: 8,
            border: '1px solid #d6dce5',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 8 }}>Launch</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Launch readiness checklist</p>
        </Link>
      </div>
    </main>
  );
}
