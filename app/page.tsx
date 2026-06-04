import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { UploadSourcesSection, StudyIntelligenceSection } from '@/components/landing/MiddleFeatures';
import { AutopsyFeature } from '@/components/landing/AutopsyFeature';
import { SourceGroundingSection, MissionLoopSection, SubjectsSection, CTASection, Footer } from '@/components/landing/BottomSections';

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

  return (
    <main className="relative bg-[#050608] min-h-screen text-slate-100 selection:bg-purple-500/30 font-sans">
      <Navbar />
      <HeroSection />
      
      <div id="features">
        <UploadSourcesSection />
        <StudyIntelligenceSection />
      </div>
      
      <div id="method">
        <AutopsyFeature />
        <SourceGroundingSection />
        <MissionLoopSection />
      </div>
      
      <SubjectsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
