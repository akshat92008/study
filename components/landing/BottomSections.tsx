'use client';
import { motion } from 'framer-motion';
import { Quote, Link as LinkIcon, RefreshCcw, BookOpen, Atom, Code, Briefcase, Globe, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function SourceGroundingSection() {
  return (
    <section className="py-24 relative border-y border-white/5 bg-[#030014]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="text-3xl font-display font-medium tracking-tight text-white sm:text-4xl">See the source, not just the answer</h2>
            <p className="mt-6 text-lg text-neutral-400">
              Every explanation stays grounded in your uploaded sources, so you can verify, trust, and revise with confidence.
            </p>
          </div>
          <div className="flex-1 w-full max-w-md">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl border border-white/10 bg-neutral-900 overflow-hidden shadow-2xl p-6"
            >
              <div className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded bg-purple-500/20 flex flex-shrink-0 items-center justify-center">
                   <Quote className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    &quot;...the mitochondria is considered the powerhouse of the cell because it generates most of the chemical energy needed to power the cell&apos;s biochemical reactions.&quot;
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-neutral-400">
                      <LinkIcon className="h-3 w-3 text-blue-400" />
                      Biology_Ch4.pdf (Pg 42)
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-neutral-400">
                      <LinkIcon className="h-3 w-3 text-red-400" />
                      Lecture_Transcript.txt
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MissionLoopSection() {
  return (
    <section className="py-24 sm:py-32 relative text-center">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl"
        >
          <div className="h-12 w-12 mx-auto flex items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <RefreshCcw className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-display font-medium tracking-tight text-white sm:text-5xl">Your daily mission loop</h2>
          <p className="mt-6 text-lg text-neutral-400">
            Cognition OS turns your learning activity into a daily mission. It knows what you studied, what you missed, what you forgot, and what you should do next.
          </p>
          
          <div className="mt-16 flex flex-wrap justify-center items-center gap-4 text-sm font-medium text-neutral-300">
            <span className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Upload</span>
            <span className="text-neutral-600 font-sans">→</span>
            <span className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Practice</span>
            <span className="text-neutral-600 font-sans">→</span>
            <span className="px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-200">Autopsy</span>
            <span className="text-neutral-600 font-sans">→</span>
            <span className="px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-200">Next Mission</span>
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
  ]
  return (
    <section className="py-24 relative overflow-hidden bg-neutral-900 text-center border-y border-white/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <h2 className="text-2xl font-display font-medium text-white mb-10">Built for any subject</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {subjects.map((sub, i) => (
             <motion.div 
               key={i}
               whileHover={{ y: -2 }}
               className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/5 bg-black/40 text-sm text-neutral-300"
             >
               <sub.icon className="h-4 w-4 text-neutral-500" />
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
    <section id="pricing" className="py-24 sm:py-32 relative">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="relative rounded-3xl border border-white/10 bg-black/60 p-8 sm:p-16 text-center overflow-hidden shadow-2xl backdrop-blur-xl">
           <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
           <h2 className="relative z-10 text-3xl font-display font-medium tracking-tight text-white sm:text-5xl">Build your comeback system.</h2>
           <p className="relative z-10 mt-6 text-lg text-neutral-400 max-w-2xl mx-auto">
             Start with your first learning goal. Upload sources, ask questions, review mistakes, and let Cognition OS generate your next mission.
           </p>
           <div className="relative z-10 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
             <button className="w-full sm:w-auto rounded-full bg-purple-600 px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 transition-all">
               Launch Cognition OS
             </button>
             <button className="w-full sm:w-auto rounded-full px-8 py-4 text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-all">
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
    <footer className="border-t border-white/5 py-12 text-center text-sm text-neutral-500">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
           <div className="h-6 w-6 rounded bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
             <span className="text-purple-400 font-display font-bold text-xs">C</span>
           </div>
           <span className="font-display text-neutral-300">Cognition OS</span>
        </div>
        <div className="flex flex-wrap justify-center">
          <Link href="#" className="mx-3 text-neutral-400 hover:text-neutral-300 transition-colors">Product</Link>
          <Link href="#" className="mx-3 text-neutral-400 hover:text-neutral-300 transition-colors">Privacy</Link>
          <Link href="#" className="mx-3 text-neutral-400 hover:text-neutral-300 transition-colors">Terms</Link>
          <Link href="#" className="mx-3 text-neutral-400 hover:text-neutral-300 transition-colors">Contact</Link>
        </div>
        <p>Built for serious learners.</p>
      </div>
    </footer>
  );
}
