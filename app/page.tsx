import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
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
      <section className="relative pt-32 pb-24 sm:pt-48 sm:pb-36 w-full flex justify-center overflow-hidden">
        {/* NotebookLM-style subtle aurora background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-purple-900/10 to-transparent blur-[80px] pointer-events-none" />
        
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center relative z-10">
          <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur-md shadow-sm">
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
            <Link href="/login" className="group w-full sm:w-auto rounded-full bg-white text-black px-8 py-3.5 text-sm font-medium hover:bg-neutral-200 transition-all duration-300 flex items-center justify-center gap-2">
              Start Learning
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* --- REFINED BENTO GRID --- */}
      <section id="features" className="py-24 sm:py-32 w-full flex justify-center border-t border-white/[0.04] relative bg-[#050505]">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl sm:text-4xl font-medium text-white mb-6 tracking-tight">How it works</h2>
            <p className="text-lg text-neutral-400 font-light leading-relaxed">Everything you need to master complex subjects, elegantly integrated into one seamless workflow.</p>
          </div>

          {/* Grid Layout: 2 top (wider/narrower), 2 bottom (narrower/wider) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
            
            {/* Bento Item 1: Wide */}
            <div className="md:col-span-7 rounded-[24px] border border-white/[0.06] bg-[#0A0A0A] p-8 sm:p-12 flex flex-col justify-between group hover:border-white/[0.12] transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[60px] group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
              <div className="relative z-10">
                <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 mb-8">
                  <FileUp className="h-5 w-5 text-indigo-300" />
                </div>
                <h3 className="text-xl font-medium text-white mb-3">Upload your sources</h3>
                <p className="text-neutral-400 leading-relaxed font-light text-sm sm:text-base">Bring PDFs, notes, question papers, and class material into one learning space. Cognition OS turns scattered resources into structured, searchable understanding.</p>
              </div>
            </div>

            {/* Bento Item 2: Narrow */}
            <div className="md:col-span-5 rounded-[24px] border border-white/[0.06] bg-[#0A0A0A] p-8 sm:p-12 flex flex-col justify-between group hover:border-white/[0.12] transition-colors relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[60px] group-hover:bg-purple-500/10 transition-colors pointer-events-none" />
              <div className="relative z-10">
                <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 mb-8">
                  <Zap className="h-5 w-5 text-purple-300" />
                </div>
                <h3 className="text-xl font-medium text-white mb-3">Instant Intelligence</h3>
                <p className="text-neutral-400 leading-relaxed font-light text-sm sm:text-base">Generate study guides, targeted flashcards, and personalized practice sets with a single click.</p>
              </div>
            </div>

            {/* Bento Item 3: Narrow */}
            <div className="md:col-span-5 rounded-[24px] border border-white/[0.06] bg-[#0A0A0A] p-8 sm:p-12 flex flex-col justify-between group hover:border-white/[0.12] transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[60px] group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
              <div className="relative z-10">
                <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 mb-8">
                  <Stethoscope className="h-5 w-5 text-blue-300" />
                </div>
                <h3 className="text-xl font-medium text-white mb-3">Autopsy Mistakes</h3>
                <p className="text-neutral-400 leading-relaxed font-light text-sm sm:text-base">Cognition OS rigorously investigates your mistakes to find the exact conceptual gap in your reasoning.</p>
              </div>
            </div>

            {/* Bento Item 4: Wide */}
            <div className="md:col-span-7 rounded-[24px] border border-white/[0.06] bg-[#0A0A0A] p-8 sm:p-12 flex flex-col justify-between group hover:border-white/[0.12] transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-[60px] group-hover:bg-teal-500/10 transition-colors pointer-events-none" />
              <div className="relative z-10">
                <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 mb-8">
                  <Network className="h-5 w-5 text-teal-300" />
                </div>
                <h3 className="text-xl font-medium text-white mb-3">Daily Mission Loop</h3>
                <p className="text-neutral-400 leading-relaxed font-light text-sm sm:text-base">The system maps what you studied, what you missed, and what you forgot. Every day, it dynamically generates your next precise learning mission.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section id="pricing" className="py-24 sm:py-32 w-full flex justify-center border-t border-white/[0.04] bg-[#000000] relative">
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-full rounded-[32px] border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-12 sm:p-20 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            
            <h2 className="relative z-10 text-3xl sm:text-5xl font-medium text-white mb-6 tracking-tight">Build your comeback system</h2>
            <p className="relative z-10 text-base sm:text-lg text-neutral-400 max-w-xl mx-auto mb-10 font-light leading-relaxed">
              Start with your first learning goal. Upload sources, ask questions, review mistakes, and let Cognition OS generate your next mission.
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/login" className="w-full sm:w-auto rounded-full bg-white text-black px-8 py-3.5 text-sm font-medium hover:bg-neutral-200 transition-all">
                Launch Cognition OS
              </Link>
              <Link href="/waitlist" className="w-full sm:w-auto rounded-full px-8 py-3.5 text-sm font-medium text-white border border-white/20 hover:bg-white/10 transition-all">
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
