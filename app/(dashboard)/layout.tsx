import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';
import CommandBar from '@/components/ui/CommandBar';
import ToastContainer from '@/components/ui/Toast';
import { headers } from 'next/headers';
import { getAuthRedirectUrl } from '@/lib/auth/redirects';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const headersList = await headers();
  const currentPath = headersList.get('x-pathname') || '/dashboard';
  const redirectUrl = await getAuthRedirectUrl(user, profile, currentPath);
  
  if (redirectUrl) {
    redirect(redirectUrl);
  }

  // Clean layout — ONE sidebar inside DashboardClientLayout.
  // No hardcoded stub sidebar here. No double wrapping.
  return (
    <DashboardClientLayout profile={profile}>
      {children}
      <CommandBar />
      <ToastContainer />
      <RealtimeProvider>{null}</RealtimeProvider>
    </DashboardClientLayout>
  );
}
