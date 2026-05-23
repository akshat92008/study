import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';
import CommandBar from '@/components/ui/CommandBar';
import ToastContainer from '@/components/ui/Toast';
import SessionTracker from '@/components/layout/SessionTracker';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
// GlobalAssistant intentionally removed — GlobalChat in DashboardClientLayout is the single chat surface

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // New layout: sidebar (icon rail) + dominant chat panel
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Sidebar - collapsed by default */}
      <aside style={{
        width: '56px',
        flexShrink: 0,
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '12px',
      }}>
        {/* Icon rail – replace with actual navigation icons as needed */}
        {/* Example placeholder icons */}
        <button style={{ background: 'none', border: 'none', marginBottom: '12px' }} title="Dashboard">
          <svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 13h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 3h8v8H3z" fill="currentColor"/></svg>
        </button>
        {/* Add more icons as needed */}
      </aside>
      {/* Main chat area */}
      <main style={{
        flex: 1,
        minWidth: '60vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--chat-bg)',
      }}>
        <DashboardClientLayout profile={profile}>
          {children}
          <CommandBar />
          <ToastContainer />
          <SessionTracker />
          <RealtimeProvider>{null}</RealtimeProvider>
        </DashboardClientLayout>
      </main>
    </div>
  );
}
