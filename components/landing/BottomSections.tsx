'use client';
import { motion } from 'framer-motion';
import { Quote, Link as LinkIcon, RefreshCcw, BookOpen, Atom, Code, Briefcase, Globe, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function SourceGroundingSection() {
  return (
    <section className="py-16 sm:py-24 relative border-y border-white/5 bg-[#030014]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center flex flex-col gap-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl"
        >
          <h2 className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl leading-tight">See the source, not just the answer</h2>
          <p className="mt-8 text-lg sm:text-xl text-neutral-400 font-light leading-relaxed">
            Every explanation stays grounded in your uploaded sources, so you can verify, trust, and revise with confidence.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl relative rounded-2xl border border-white/10 bg-[#050608] overflow-hidden shadow-2xl p-6 sm:p-8 text-left"
        >
          <div className="flex flex-col gap-4">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex flex-shrink-0 items-center justify-center border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
               <Quote className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-base sm:text-lg text-neutral-300 leading-relaxed italic">
                &quot;...the mitochondria is considered the powerhouse of the cell because it generates most of the chemical energy needed to power the cell&apos;s biochemical reactions.&quot;
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-neutral-400 font-medium hover:bg-white/10 transition-colors cursor-pointer">
                  <LinkIcon className="h-4 w-4 text-blue-400" />
                  Biology_Ch4.pdf (Pg 42)
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-neutral-400 font-medium hover:bg-white/10 transition-colors cursor-pointer">
                  <LinkIcon className="h-4 w-4 text-red-400" />
                  Lecture_Transcript.txt
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function MissionLoopSection() {
  return (
    <section className="py-16 sm:py-24 relative text-center bg-[#050608]">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col gap-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl"
        >
          <div className="w-full mb-8" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.2)]" style={{ margin: '0 auto' }}>
              <RefreshCcw className="h-8 w-8 text-indigo-400" />
            </div>
          </div>
          <h2 className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl leading-tight">Your daily mission loop</h2>
          <p className="mt-8 text-lg sm:text-xl text-neutral-400 font-light leading-relaxed">
            Cognition OS turns your learning activity into a daily mission. It knows what you studied, what you missed, what you forgot, and what you should do next.
          </p>
          
          <div className="mt-16 flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-sm font-medium text-neutral-300">
            <span className="px-6 py-3 rounded-full border border-white/10 bg-white/5 shadow-sm">Upload</span>
            <span className="text-neutral-600 font-sans text-xl hidden sm:block">→</span>
            <span className="px-6 py-3 rounded-full border border-white/10 bg-white/5 shadow-sm">Practice</span>
            <span className="text-neutral-600 font-sans text-xl hidden sm:block">→</span>
            <span className="px-6 py-3 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-200 shadow-sm">Autopsy</span>
            <span className="text-neutral-600 font-sans text-xl hidden sm:block">→</span>
            <span className="px-6 py-3 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/50">Next Mission</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function SubjectsSection() {
  const subjects = [
    { name: "School Exams", icon: BookOpen },
    { name: "Competitive", icon: ShieldCheck },
    { name: "Medical", icon: Atom },
    { name: "Engineering", icon: Code },
    { name: "Business", icon: Briefcase },
    { name: "Languages", icon: Globe },
  ];
  return (
    <section className="py-16 sm:py-24 relative overflow-hidden bg-[#030014] text-center border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center">
        <h2 className="text-3xl font-display font-medium text-white mb-8">Built for any subject</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {subjects.map((sub, i) => (
             <motion.div 
               key={i}
               whileHover={{ y: -2 }}
               className="flex items-center gap-3 px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-base text-neutral-300 shadow-sm cursor-default"
             >
               <sub.icon className="h-5 w-5 text-neutral-400" />
               {sub.name}
             </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section id="pricing" className="py-16 sm:py-24 relative bg-[#050608] border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="relative w-full max-w-4xl rounded-[2rem] border border-purple-500/20 bg-gradient-to-b from-purple-900/10 to-black/60 p-10 sm:p-12 md:p-16 flex flex-col items-center gap-6 text-center overflow-hidden shadow-2xl backdrop-blur-xl mx-auto">
           <div className="absolute inset-0 bg-gradient-to-b from-purple-600/10 to-transparent pointer-events-none" />
           <h2 className="relative z-10 text-4xl font-display font-medium tracking-tight text-white sm:text-6xl leading-tight">Build your comeback system</h2>
           <p className="relative z-10 text-xl text-neutral-400 font-light max-w-2xl mx-auto leading-relaxed">
             Start with your first learning goal. Upload sources, ask questions, review mistakes, and let Cognition OS generate your next mission.
           </p>
           <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
             <button className="w-full sm:w-auto rounded-full bg-purple-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:bg-purple-500 transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap">
               Launch Cognition OS
             </button>
             <button className="w-full sm:w-auto rounded-full px-8 py-4 text-base font-semibold text-white border border-white/20 hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap">
               Join private beta
             </button>
           </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/5 py-16 text-center text-sm text-neutral-500 bg-[#030014] w-full flex justify-center">
      <div className="w-full max-w-7xl px-6 lg:px-8 flex flex-col items-center gap-8 relative z-10">
        <div className="flex items-center gap-3">
           <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
             <span className="text-purple-400 font-display font-bold text-sm">C</span>
           </div>
           <span className="font-display text-lg text-neutral-300 font-medium">Cognition OS</span>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          <Link href="#" className="text-neutral-400 hover:text-white transition-colors">Product</Link>
          <Link href="#" className="text-neutral-400 hover:text-white transition-colors">Privacy</Link>
          <Link href="#" className="text-neutral-400 hover:text-white transition-colors">Terms</Link>
          <Link href="#" className="text-neutral-400 hover:text-white transition-colors">Contact</Link>
        </div>
        <p className="mt-4 font-light text-neutral-600">Built for serious learners.</p>
      </div>
    </footer>
  );
}
