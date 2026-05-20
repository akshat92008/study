import { redirect } from 'next/navigation';
import { initializeConcepts } from '@/lib/actions/cognition';

export default async function CognitionPage() {
  // Ensure concepts are initialized, then redirect
  await initializeConcepts();
  redirect('/dashboard');
}
