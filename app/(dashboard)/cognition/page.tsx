import { redirect } from 'next/navigation';
import { initializeConcepts } from '@/lib/actions/cognition';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CognitionPage({ searchParams }: PageProps) {
  // Ensure concepts are initialized, then redirect
  await initializeConcepts();

  const resolvedParams = await searchParams;
  const magic = resolvedParams?.magic === 'true' ? 'magic=true' : '';
  const firstTime = resolvedParams?.firstTime === 'true' ? 'firstTime=true' : '';
  const query = [magic, firstTime].filter(Boolean).join('&');

  redirect(`/dashboard${query ? `?${query}` : ''}`);
}
