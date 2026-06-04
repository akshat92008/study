import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { UploadSourcesSection, StudyIntelligenceSection } from '@/components/landing/MiddleFeatures';
import { AutopsyFeature } from '@/components/landing/AutopsyFeature';
import { SourceGroundingSection, MissionLoopSection, SubjectsSection, CTASection, Footer } from '@/components/landing/BottomSections';

export default function LandingPage() {
  return (
    <main className="relative bg-[#030014] min-h-screen text-slate-100 selection:bg-purple-500/30">
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
