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

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  let user = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (
      (error as any)?.code === 'refresh_token_not_found' ||
      error?.message?.includes('Invalid Refresh Token')
    ) {
      return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
    }

    user = data.user;

    const { data: profile } = user
      ? await supabase
          .from('profiles')
          .select('onboarding_complete')
          .eq('id', user.id)
          .maybeSingle()
      : { data: null };

    const redirectUrl = await getAuthRedirectUrl(user, profile, '/');

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  } catch (error) {
    console.error('[LANDING_AUTH_ERROR]', error);
  }

  return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
}
