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

  return (
    <DashboardClientLayout profile={profile}>
      {children}
      <CommandBar />
      <ToastContainer />
      <SessionTracker />
      <RealtimeProvider>{null}</RealtimeProvider>
    </DashboardClientLayout>
  );
}
