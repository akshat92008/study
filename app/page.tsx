import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/BottomSections';
import { 
  ArrowRight, Sparkles, FileUp, 
  Zap, Stethoscope, Network
} from 'lucide-react';

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
    <main className="relative bg-[#000000] min-h-screen text-slate-100 selection:bg-indigo-500/30 font-sans overflow-hidden">
      <Navbar />
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-40 pb-32 sm:pt-56 sm:pb-48 w-full flex justify-center overflow-hidden">
        {/* Subtle aurora background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-purple-900/10 to-transparent blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center relative z-10">
          <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur-md shadow-sm transition-all hover:bg-white/10">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Cognition OS Beta is live</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight text-white leading-[1.1] mb-8 font-display">
            Understand <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-white to-purple-300">Anything</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto font-light mb-12 leading-relaxed">
            Your personalized AI learning operating system. Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link href="/login" className="group w-full sm:w-auto rounded-full bg-white text-black px-8 py-4 text-sm font-medium hover:bg-neutral-200 transition-all duration-300 flex items-center justify-center gap-2">
              Start Learning
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* --- ALTERNATING FEATURES SECTION (NotebookLM Style) --- */}
      <section id="features" className="py-24 sm:py-32 w-full flex flex-col items-center border-t border-white/[0.04] relative bg-[#020202]">
        
        <div className="text-center max-w-3xl mx-auto mb-24 px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-5xl font-medium text-white mb-6 tracking-tight">How it works</h2>
          <p className="text-xl text-neutral-400 font-light leading-relaxed">Everything you need to master complex subjects, elegantly integrated into one seamless workflow.</p>
        </div>

        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-32">
          
          {/* Feature 1: Upload (Text Left, Image Right) */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left order-2 lg:order-1">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-8 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
                <FileUp className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">Upload your sources</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                Bring PDFs, notes, question papers, and class material into one learning space. Cognition OS turns scattered resources into structured, searchable understanding.
              </p>
            </div>
            <div className="w-full lg:w-7/12 order-1 lg:order-2 relative group">
              <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[32px] overflow-hidden border border-white/[0.08] shadow-2xl bg-[#0A0A0A] aspect-[4/3] flex items-center justify-center">
                <Image src="/images/landing/upload_sources_ui_1780661269864.png" alt="Upload Interface" fill className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
          </div>

          {/* Feature 2: Instant Intelligence (Image Left, Text Right) */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
            <div className="w-full lg:w-7/12 relative group">
              <div className="absolute inset-0 bg-purple-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[32px] overflow-hidden border border-white/[0.08] shadow-2xl bg-[#0A0A0A] aspect-[4/3] flex items-center justify-center">
                <Image src="/images/landing/instant_intelligence_ui_1780661283289.png" alt="Instant Intelligence Interface" fill className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-8 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">Instant Intelligence</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                Generate highly tailored study guides, targeted flashcards, and personalized practice sets with a single click, allowing you to focus on learning rather than organizing.
              </p>
            </div>
          </div>

          {/* Feature 3: Autopsy Mistakes (Text Left, Image Right) */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left order-2 lg:order-1">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-8 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <Stethoscope className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">Autopsy Mistakes</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                Don't just see what you got wrong; understand *why*. Cognition OS rigorously investigates your mistakes to find the exact conceptual gap in your reasoning.
              </p>
            </div>
            <div className="w-full lg:w-7/12 order-1 lg:order-2 relative group">
               <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[32px] overflow-hidden border border-white/[0.08] shadow-2xl bg-[#0A0A0A] aspect-[4/3] flex items-center justify-center">
                <Image src="/images/landing/autopsy_mistakes_ui_1780661300509.png" alt="Autopsy Mistakes Interface" fill className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
          </div>

          {/* Feature 4: Daily Mission Loop (Image Left, Text Right) */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
            <div className="w-full lg:w-7/12 relative group">
              <div className="absolute inset-0 bg-teal-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[32px] overflow-hidden border border-white/[0.08] shadow-2xl bg-[#0A0A0A] aspect-[4/3] flex items-center justify-center">
                <Image src="/images/landing/daily_mission_ui_1780661313038.png" alt="Daily Mission Interface" fill className="object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 mb-8 shadow-[0_0_30px_rgba(20,184,166,0.15)]">
                <Network className="h-6 w-6 text-teal-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">Daily Mission Loop</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                The system maps what you studied, what you missed, and what you forgot. Every day, it dynamically generates your next precise learning mission for maximum retention.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section id="pricing" className="py-32 sm:py-48 w-full flex justify-center border-t border-white/[0.04] bg-[#000000] relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/20 via-purple-900/5 to-transparent blur-[80px] pointer-events-none" />
        
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-full rounded-[40px] border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-black p-16 sm:p-24 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            
            <h2 className="relative z-10 text-4xl sm:text-6xl font-medium text-white mb-8 tracking-tight font-display">Build your comeback system</h2>
            <p className="relative z-10 text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              Start with your first learning goal. Upload sources, ask questions, review mistakes, and let Cognition OS generate your next mission.
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row gap-6 w-full sm:w-auto">
              <Link href="/login" className="w-full sm:w-auto rounded-full bg-white text-black px-10 py-4 text-base font-medium hover:bg-neutral-200 transition-all hover:scale-105 duration-300">
                Launch Cognition OS
              </Link>
              <Link href="/waitlist" className="w-full sm:w-auto rounded-full px-10 py-4 text-base font-medium text-white border border-white/20 hover:bg-white/10 transition-all hover:scale-105 duration-300">
                Join private beta
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
