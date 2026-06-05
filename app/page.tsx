import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CinematicLandingPage } from '@/components/landing/CinematicLandingPage';
import { existsSync } from 'node:fs';
import path from 'node:path';

const landingVideoPaths = [
  '/landing/goal-roadmap.mp4',
  '/landing/source-memory.mp4',
  '/landing/tutor-context.mp4',
  '/landing/autopsy.mp4',
  '/landing/daily-mission.mp4',
];

function getAvailableLandingVideos() {
  return landingVideoPaths.filter((videoPath) =>
    existsSync(path.join(process.cwd(), 'public', videoPath)),
  );
}

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();
    redirect(profile?.onboarding_complete ? '/dashboard' : '/onboarding');
  }

  return <CinematicLandingPage availableVideos={getAvailableLandingVideos()} />;
}
