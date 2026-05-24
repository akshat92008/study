import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CognitionPage({ searchParams }: PageProps) {
  // Check auth only — no seeding here, dashboard loads its own data
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const magic = resolvedParams?.magic === 'true' ? 'magic=true' : '';
  const firstTime = resolvedParams?.firstTime === 'true' ? 'firstTime=true' : '';
  const query = [magic, firstTime].filter(Boolean).join('&');

  redirect(`/dashboard${query ? `?${query}` : ''}`);
}