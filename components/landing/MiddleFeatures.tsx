'use client';
import { motion } from 'framer-motion';
import { FileUp, FileText, Zap, Brain, Crosshair, Network, BarChart } from 'lucide-react';

export function UploadSourcesSection() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-transparent border-t border-white/[0.02]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="h-16 w-16 mx-auto flex items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-8 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <FileUp className="h-8 w-8 text-purple-400" />
          </div>
          <h2 className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl leading-[1.1]">
            Upload your scattered sources
          </h2>
          <p className="mt-8 text-xl leading-relaxed text-neutral-400 font-light">
            Bring PDFs, notes, question papers, videos, and class material into one learning space. Cognition OS turns scattered resources into structured, interrogatable understanding.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export function StudyIntelligenceSection() {
  const cards = [
    { title: "Study Guide", icon: FileText, delay: 0 },
    { title: "Flashcards", icon: Zap, delay: 0.1 },
    { title: "Formula Sheet", icon: BarChart, delay: 0.2 },
    { title: "MCQ Practice", icon: Crosshair, delay: 0.3 },
    { title: "Concept Map", icon: Network, delay: 0.4 },
    { title: "Revision Queue", icon: Brain, delay: 0.5 },
  ];

  return (
    <section className="py-24 relative overflow-hidden border-y border-white/[0.02]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-purple-500/5 blur-[120px] rounded-[100%] pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl"
          >
            Instant Study Intelligence
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-xl text-neutral-400 font-light leading-relaxed"
          >
            Generate study guides, flashcards, formula sheets, practice sets, and revision plans from your own material with one click.
          </motion.p>
        </div>
        
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-6">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: card.delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.01] p-8 flex flex-col items-center text-center overflow-hidden hover:bg-white/[0.03] transition-all duration-300"
            >
              <div className="relative z-10 w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6 group-hover:border-purple-500/30 group-hover:bg-purple-500/5 transition-all duration-300 shadow-sm">
                <card.icon className="h-6 w-6 text-neutral-400 group-hover:text-purple-300 transition-colors duration-300" />
              </div>
              <h3 className="text-base font-medium text-neutral-300 group-hover:text-purple-100 transition-colors duration-300">{card.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
