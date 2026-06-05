import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/BottomSections';
import { 
  ArrowRight, Sparkles, FileUp, 
  Zap, Stethoscope, Network, BookOpen, BrainCircuit
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
    <main className="relative bg-[#020202] min-h-screen text-slate-100 selection:bg-indigo-500/30 font-sans overflow-hidden">
      <Navbar />
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-24 sm:pt-48 sm:pb-32 w-full flex justify-center overflow-hidden">
        {/* Subtle aurora background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-purple-900/10 to-transparent blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center relative z-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur-md shadow-sm transition-all hover:bg-white/10 cursor-default">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Cognition OS Beta is live</span>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-semibold tracking-tight text-white leading-[1.1] mb-6 font-display">
            Understand <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-white to-purple-300">Anything</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto font-light mb-10 leading-relaxed">
            Your personalized AI learning operating system. Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link href="/login" className="group w-full sm:w-auto rounded-full bg-white text-black px-8 py-3.5 text-sm font-semibold hover:bg-neutral-200 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              Start Learning
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="mt-16 flex items-center justify-center gap-8 text-sm text-neutral-500 font-medium">
            <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> <span>Upload NCERTs</span></div>
            <div className="flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> <span>AI Tutor</span></div>
            <div className="flex items-center gap-2"><Stethoscope className="w-4 h-4" /> <span>Mistake Autopsy</span></div>
          </div>
        </div>
      </section>

      {/* --- ALTERNATING FEATURES SECTION --- */}
      <section id="features" className="py-20 sm:py-28 w-full flex flex-col items-center border-t border-white/[0.04] relative bg-[#020202]">
        
        <div className="text-center max-w-3xl mx-auto mb-20 px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-5xl font-semibold text-white mb-6 tracking-tight">How it works</h2>
          <p className="text-xl text-neutral-400 font-light leading-relaxed">Everything you need to master complex subjects, elegantly integrated into one seamless workflow.</p>
        </div>

        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-24 sm:gap-32">
          
          {/* Feature 1: Upload */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left order-2 lg:order-1">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
                <FileUp className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-semibold text-white mb-4 tracking-tight">Upload your sources</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                Bring PDFs, notes, question papers, and class material into one learning space. Cognition OS turns scattered resources into structured, searchable understanding.
              </p>
            </div>
            <div className="w-full lg:w-7/12 order-1 lg:order-2 relative group">
              <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[24px] overflow-hidden border border-white/[0.08] shadow-2xl bg-gradient-to-br from-neutral-900 to-black aspect-[16/10] flex flex-col items-center justify-center p-8">
                {/* Abstract UI Mockup */}
                <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-sm transform transition-transform group-hover:scale-105 duration-500">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded bg-indigo-500/20 flex items-center justify-center"><FileUp className="w-5 h-5 text-indigo-400" /></div>
                    <div>
                      <div className="h-3 w-32 bg-white/20 rounded mb-2"></div>
                      <div className="h-2 w-20 bg-white/10 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-white/5 rounded"></div>
                    <div className="h-2 w-5/6 bg-white/5 rounded"></div>
                    <div className="h-2 w-4/6 bg-white/5 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Instant Intelligence */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full lg:w-7/12 relative group">
              <div className="absolute inset-0 bg-purple-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[24px] overflow-hidden border border-white/[0.08] shadow-2xl bg-gradient-to-br from-neutral-900 to-black aspect-[16/10] flex items-center justify-center p-8">
                {/* Abstract UI Mockup */}
                <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-sm transform transition-transform group-hover:-translate-y-2 duration-500">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="h-20 w-full bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 flex flex-col justify-end">
                        <div className="h-2 w-1/2 bg-purple-400/50 rounded mb-1"></div>
                        <div className="h-2 w-1/3 bg-purple-400/30 rounded"></div>
                      </div>
                      <div className="h-20 w-full bg-white/5 rounded-lg border border-white/5"></div>
                    </div>
                    <div className="w-1/3 bg-white/5 rounded-lg border border-white/5 p-3 space-y-2">
                      <div className="h-2 w-full bg-white/10 rounded"></div>
                      <div className="h-2 w-full bg-white/10 rounded"></div>
                      <div className="h-2 w-2/3 bg-white/10 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-semibold text-white mb-4 tracking-tight">Instant Intelligence</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                Generate highly tailored study guides, targeted flashcards, and personalized practice sets with a single click, allowing you to focus on learning rather than organizing.
              </p>
            </div>
          </div>

          {/* Feature 3: Autopsy Mistakes */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left order-2 lg:order-1">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <Stethoscope className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-semibold text-white mb-4 tracking-tight">Autopsy Mistakes</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                Don't just see what you got wrong; understand *why*. Cognition OS rigorously investigates your mistakes to find the exact conceptual gap in your reasoning.
              </p>
            </div>
            <div className="w-full lg:w-7/12 order-1 lg:order-2 relative group">
               <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[24px] overflow-hidden border border-white/[0.08] shadow-2xl bg-gradient-to-br from-neutral-900 to-black aspect-[16/10] flex items-center justify-center p-8">
                {/* Abstract UI Mockup */}
                <div className="w-full max-w-sm space-y-3 transform transition-transform group-hover:scale-105 duration-500">
                  <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-4 h-4 rounded-full bg-red-500/50 mt-1"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-2 w-3/4 bg-red-400/50 rounded"></div>
                      <div className="h-2 w-1/2 bg-red-400/30 rounded"></div>
                    </div>
                  </div>
                  <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 ml-8 flex items-start gap-3">
                    <Stethoscope className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-2 w-full bg-blue-400/50 rounded"></div>
                      <div className="h-2 w-5/6 bg-blue-400/30 rounded"></div>
                      <div className="h-2 w-4/6 bg-blue-400/30 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 4: Daily Mission Loop */}
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="w-full lg:w-7/12 relative group">
              <div className="absolute inset-0 bg-teal-500/20 blur-[100px] rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative rounded-[24px] overflow-hidden border border-white/[0.08] shadow-2xl bg-gradient-to-br from-neutral-900 to-black aspect-[16/10] flex items-center justify-center p-8">
                {/* Abstract UI Mockup */}
                <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-sm transform transition-transform group-hover:translate-y-2 duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-4 w-32 bg-white/20 rounded-full"></div>
                    <div className="h-6 w-16 bg-teal-500/20 rounded-full border border-teal-500/30"></div>
                  </div>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${i === 1 ? 'bg-teal-500/20 border-teal-500/50 border' : 'bg-white/5 border border-white/10'}`}>
                          {i === 1 && <div className="w-2 h-2 rounded-full bg-teal-400"></div>}
                        </div>
                        <div className="flex-1 h-12 bg-white/5 rounded-lg border border-white/5 flex items-center px-4">
                          <div className="h-2 w-1/2 bg-white/20 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-5/12 flex flex-col items-start text-left">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 mb-6 shadow-[0_0_30px_rgba(20,184,166,0.15)]">
                <Network className="h-6 w-6 text-teal-400" />
              </div>
              <h3 className="text-3xl sm:text-4xl font-semibold text-white mb-4 tracking-tight">Daily Mission Loop</h3>
              <p className="text-lg text-neutral-400 leading-relaxed font-light">
                The system maps what you studied, what you missed, and what you forgot. Every day, it dynamically generates your next precise learning mission for maximum retention.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section id="pricing" className="pt-24 pb-12 sm:pt-32 sm:pb-16 w-full flex justify-center border-t border-white/[0.04] bg-[#020202] relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/20 via-purple-900/5 to-transparent blur-[80px] pointer-events-none" />
        
        <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-full rounded-[32px] border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-black p-12 sm:p-20 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            
            <h2 className="relative z-10 text-3xl sm:text-5xl font-semibold text-white mb-6 tracking-tight font-display">Build your comeback system</h2>
            <p className="relative z-10 text-lg sm:text-xl text-neutral-400 max-w-xl mx-auto mb-10 font-light leading-relaxed">
              Start with your first learning goal. Upload sources, ask questions, review mistakes, and let Cognition OS generate your next mission.
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/login" className="w-full sm:w-auto rounded-full bg-white text-black px-8 py-3.5 text-sm font-semibold hover:bg-neutral-200 hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                Launch Cognition OS
              </Link>
              <Link href="/waitlist" className="w-full sm:w-auto rounded-full px-8 py-3.5 text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-all hover:scale-105 duration-300">
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
