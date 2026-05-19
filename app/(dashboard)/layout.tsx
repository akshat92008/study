import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import CommandBar from '@/components/ui/CommandBar';
import ToastContainer from '@/components/ui/Toast';
import SessionTracker from '@/components/layout/SessionTracker';
import GlobalAssistant from '@/components/layout/GlobalAssistant'; // <--- NEW

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const isOverwhelmed = profile?.emotional_state === 'overwhelmed';

  return (
    <div 
      className={isOverwhelmed ? 'recovery-mode' : ''}
      style={{
        display: 'flex', minHeight: '100vh', background: 'var(--bg-root)',
      }}
    >
      <Sidebar userName={profile?.full_name || 'Student'} examType={profile?.exam_type || 'General'} />
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
      
      {/* THE NEW GLOBAL COPILOT */}
      <GlobalAssistant />
      
    </div>
  );
}
