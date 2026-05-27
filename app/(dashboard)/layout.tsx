import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';
import CommandBar from '@/components/ui/CommandBar';
import ToastContainer from '@/components/ui/Toast';
import SessionTracker from '@/components/layout/SessionTracker';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

  // Clean layout — ONE sidebar inside DashboardClientLayout.
  // No hardcoded stub sidebar here. No double wrapping.
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
