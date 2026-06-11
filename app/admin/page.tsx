import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/admin';
import { AdminCard } from './AdminCard';

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
    title: 'Amaura Runtime',
    description: 'View and manage Amaura Runtime runs',
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
          <AdminCard
            key={section.title}
            title={section.title}
            description={section.description}
            href={section.href}
            icon={section.icon}
          />
        ))}
      </div>
    </main>
  );
}
