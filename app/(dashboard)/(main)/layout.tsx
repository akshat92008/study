import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';
import CommandBar from '@/components/ui/CommandBar';
import ToastContainer from '@/components/ui/Toast';
import { headers } from 'next/headers';
import { getAuthRedirectUrl } from '@/lib/auth/redirects';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';

export const dynamic = 'force-dynamic';

const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await withTimeout(
    supabase.auth.getUser(), 
    5000, 
    "Supabase auth.getUser() timed out!"
  );

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await withTimeout(
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    5000,
    "Supabase profiles query timed out!"
  );

  const headersList = await headers();
  const currentPath = headersList.get('x-pathname') || '/dashboard';
  
  const redirectUrl = await withTimeout(
    getAuthRedirectUrl(user, profile, currentPath),
    5000,
    "getAuthRedirectUrl timed out!"
  );
  
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
