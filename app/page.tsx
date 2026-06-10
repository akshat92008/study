import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getAuthRedirectUrl } from '@/lib/auth/redirects';
import { CinematicLandingPage } from '@/components/landing/CinematicLandingPage';
import { existsSync } from 'node:fs';
import path from 'node:path';

const landingVideoPaths = [
  '/landing/videos/goal-roadmap.mp4',
  '/landing/videos/source-memory.mp4',
  '/landing/videos/tutor-context.mp4',
  '/landing/videos/autopsy.mp4',
  '/landing/videos/review-memory.mp4',
  '/landing/videos/daily-mission.mp4',
];

function getAvailableLandingVideos() {
  return landingVideoPaths.filter((videoPath) =>
    existsSync(path.join(process.cwd(), 'public', videoPath)),
  );
}

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .maybeSingle() : { data: null };

  const redirectUrl = await getAuthRedirectUrl(user, profile, '/');
  if (redirectUrl) {
    redirect(redirectUrl);
  }

  return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
}
