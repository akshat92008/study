import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function EducatorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('institute_memberships')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'educator') {
    redirect('/dashboard');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-root)' }}>
      {/* Basic Sidebar for Educator */}
      <aside style={{ width: '250px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-default)', padding: 'var(--sp-6)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 'var(--sp-6)' }}>Cognition Teams</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <a href="/educator" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>Dashboard</a>
          <a href="#" style={{ color: 'var(--text-secondary)' }}>Students</a>
          <a href="#" style={{ color: 'var(--text-secondary)' }}>Settings</a>
        </nav>
      </aside>
      
      <main style={{ flex: 1, padding: 'var(--sp-8)' }}>
        {children}
      </main>
    </div>
  );
}
