import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

const adminSections = [
  {
    title: 'Users',
    description: 'Manage user accounts, plans, and access',
    href: '/admin/users',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
  },
  {
    title: 'Queue',
    description: 'Monitor and retry failed background jobs',
    href: '/admin/queue',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    ),
  },
  {
    title: 'Hermes',
    description: 'View and manage Hermes runs',
    href: '/admin/hermes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M2 12h2"></path>
        <path d="M20 12h2"></path>
        <path d="M12 2v2"></path>
        <path d="M12 20v2"></path>
        <path d="m4.93 4.93 1.41 1.41"></path>
        <path d="m17.66 17.66 1.41 1.41"></path>
        <path d="m4.93 19.07 1.41-1.41"></path>
        <path d="m17.66 6.34 1.41-1.41"></path>
      </svg>
    ),
  },
  {
    title: 'Launch',
    description: 'Launch readiness checklist',
    href: '/admin/launch',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    ),
  },
];

export default async function AdminRootPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect('/login?next=/admin');
  if (auth.status === 403) redirect('/dashboard');

  return (
    <main style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: 'var(--sp-8)',
      minHeight: '100vh',
      background: 'var(--bg-root)',
    }}>
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          margin: 0,
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>Admin Dashboard</h1>
        <p style={{
          color: 'var(--text-secondary)',
          margin: 'var(--sp-2) 0 0 0',
        }}>Manage your Cognition OS instance</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--sp-5)',
      }}>
        {adminSections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            style={{ textDecoration: 'none' }}
          >
            <Card
              variant="glass"
              style={{
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                ':hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 'var(--shadow-glow-blue)',
                },
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-glow-blue)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <CardHeader>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  color: 'var(--accent-blue)',
                }}>
                  {section.icon}
                </div>
                <CardTitle style={{ marginTop: 'var(--sp-3)' }}>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p style={{
                  margin: 0,
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                }}>{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
