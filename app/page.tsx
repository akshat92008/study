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

const withTimeout = <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
};

export default async function LandingPage() {
  let redirectUrl: string | null = null;

  try {
    const supabase = await createClient();

    const { data: { user } } = await withTimeout(
      supabase.auth.getUser(),
      5000,
      'Home auth.getUser() timed out'
    );

    const { data: profile } = user
      ? await withTimeout(
          supabase
            .from('profiles')
            .select('onboarding_complete')
            .eq('id', user.id)
            .maybeSingle(),
          5000,
          'Home profile query timed out'
        )
      : { data: null };

    redirectUrl = await withTimeout(
      getAuthRedirectUrl(user, profile, '/'),
      5000,
      'Home access redirect check timed out'
    );
  } catch (error) {
    console.error('[HOME_BOOT_ERROR]', error);
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  }

  return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
}
