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

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Supabase Query Timeout')), ms)),
  ]);
}

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  let user = null;
  let redirectUrl = null;

  try {
    const supabase = await createClient();
    const { data, error } = await withTimeout(supabase.auth.getUser(), 3000);

    if (
      (error as any)?.code === 'refresh_token_not_found' ||
      error?.message?.includes('Invalid Refresh Token')
    ) {
      return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
    }

    user = data.user;

    const { data: profile } = user
      ? await withTimeout(
          supabase
            .from('profiles')
            .select('onboarding_complete')
            .eq('id', user.id)
            .maybeSingle(),
          3000
        )
      : { data: null };

    redirectUrl = await getAuthRedirectUrl(user, profile, '/');
  } catch (error) {
    console.error('[LANDING_AUTH_ERROR]', error);
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  }

  return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
}
