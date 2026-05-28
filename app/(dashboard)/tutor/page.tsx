import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Tutor is embedded in the main dashboard chat.
// This route deep-links there with a query param that auto-opens tutor mode.
export default async function TutorPage() {
  // Rather than rendering a duplicate chat, send them to dashboard
  // with a param that triggers tutor mode in the session card
  redirect('/dashboard?mode=tutor');
}
