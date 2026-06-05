import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/BottomSections';
import { 
  ArrowRight, Sparkles, BrainCircuit, FileUp, 
  Zap, Brain, Network, Stethoscope, RefreshCw, BarChart 
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
    <main className="relative bg-[#030014] min-h-screen text-slate-100 selection:bg-purple-500/30 font-sans overflow-hidden">
      <Navbar />
      
      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32 w-full flex justify-center">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[600px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center relative z-10">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-200 backdrop-blur-md">
            <Sparkles className="h-4 w-4" />
            <span>Cognition OS Beta is live</span>
          </div>
          
          <h1 className="font-display text-5xl sm:text-7xl lg:text-[5.5rem] font-medium tracking-tight text-white leading-[1.1] mb-6">
            Understand <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-purple-500">Anything</span>
          </h1>
          
          <p className="text-lg sm:text-xl leading-relaxed text-neutral-400 max-w-2xl mx-auto font-light mb-10">
            Your AI learning operating system. Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/login" className="group relative rounded-full bg-white text-black px-8 py-4 text-lg font-medium shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(168,85,247,0.3)] transition-all duration-300 flex items-center gap-3 hover:-translate-y-0.5">
              Start Learning
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* --- BENTO GRID FEATURES --- */}
      <section id="features" className="py-20 w-full flex justify-center border-t border-white/5 relative bg-[#050608]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-5xl font-display font-medium text-white mb-6">How it works</h2>
            <p className="text-lg text-neutral-400">Everything you need to master complex subjects, integrated into one seamless workflow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Bento Item 1 */}
            <div className="col-span-1 lg:col-span-2 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 sm:p-10 backdrop-blur-md flex flex-col justify-between group hover:border-purple-500/30 transition-colors">
              <div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 mb-6">
                  <FileUp className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-3">Upload your sources</h3>
                <p className="text-neutral-400 leading-relaxed max-w-md">Bring PDFs, notes, question papers, and class material into one learning space. Cognition OS turns scattered resources into structured understanding.</p>
              </div>
            </div>

            {/* Bento Item 2 */}
            <div className="col-span-1 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 sm:p-10 backdrop-blur-md flex flex-col justify-between group hover:border-indigo-500/30 transition-colors">
              <div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 mb-6">
                  <Zap className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-3">Instant Intelligence</h3>
                <p className="text-neutral-400 leading-relaxed">Generate study guides, flashcards, and practice sets with one click.</p>
              </div>
            </div>

            {/* Bento Item 3 */}
            <div className="col-span-1 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 sm:p-10 backdrop-blur-md flex flex-col justify-between group hover:border-blue-500/30 transition-colors">
              <div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 mb-6">
                  <Stethoscope className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-3">Autopsy Mistakes</h3>
                <p className="text-neutral-400 leading-relaxed">Cognition OS investigates mistakes to find the exact conceptual gap in your reasoning.</p>
              </div>
            </div>

            {/* Bento Item 4 */}
            <div className="col-span-1 lg:col-span-2 rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-8 sm:p-10 backdrop-blur-md flex flex-col justify-between group hover:border-teal-500/30 transition-colors">
              <div>
                <div className="h-12 w-12 rounded-xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 mb-6">
                  <Network className="h-6 w-6 text-teal-400" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-3">Daily Mission Loop</h3>
                <p className="text-neutral-400 leading-relaxed max-w-md">The system knows what you studied, what you missed, and what you forgot. Every day, it dynamically generates your next learning mission.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section id="pricing" className="py-24 w-full flex justify-center border-t border-white/5 bg-[#030014] relative">
        <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="w-full rounded-[2rem] border border-purple-500/20 bg-gradient-to-b from-purple-900/20 to-black p-10 sm:p-16 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent pointer-events-none" />
            
            <h2 className="relative z-10 text-4xl sm:text-5xl font-display font-medium text-white mb-6">Build your comeback system</h2>
            <p className="relative z-10 text-lg text-neutral-400 max-w-2xl mx-auto mb-10">
              Start with your first learning goal. Upload sources, ask questions, review mistakes, and let Cognition OS generate your next mission.
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row gap-4">
              <Link href="/login" className="rounded-full bg-purple-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:bg-purple-500 transition-all hover:-translate-y-0.5 whitespace-nowrap">
                Launch Cognition OS
              </Link>
              <Link href="/waitlist" className="rounded-full px-8 py-4 text-base font-semibold text-white border border-white/20 hover:bg-white/10 transition-all hover:-translate-y-0.5 whitespace-nowrap">
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
