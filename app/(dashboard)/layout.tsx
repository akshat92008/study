import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandBar from '@/components/ui/CommandBar';
import ToastContainer from '@/components/ui/Toast';
import SessionTracker from '@/components/layout/SessionTracker';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Redirect to onboarding if not completed (avoid loop on onboarding page itself)
  const headersList = await headers();
  const pathname = headersList.get('x-next-pathname') || '';
  if (profile && !profile.onboarding_complete && !pathname.includes('/onboarding')) {
    redirect('/onboarding');
  }


  const isOverwhelmed = profile?.emotional_state === 'overwhelmed';

  return (
    <div 
      className={isOverwhelmed ? 'recovery-mode' : ''}
      style={{
        display: 'flex', minHeight: '100vh', background: 'var(--bg-root)',
      }}
    >
      <Sidebar userName={profile?.full_name || 'Student'} examType={profile?.exam_type || 'NEET'} />
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', flexDirection: 'column' }}>
        <Header userName={profile?.full_name || 'Student'} streakDays={profile?.streak_days || 0} />
        <main style={{
          flex: 1, padding: 'var(--sp-6)',
          marginTop: 'var(--header-height)',
          maxWidth: 'var(--content-max-width)',
          width: '100%',
        }}>
          {children}
        </main>
      </div>
      <CommandBar />
      <ToastContainer />
      <SessionTracker />
    </div>
  );
}
