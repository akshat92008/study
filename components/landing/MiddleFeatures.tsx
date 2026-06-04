'use client';
import { motion } from 'framer-motion';
import { FileUp, FileText, Zap, Brain, Crosshair, Network, BarChart, MousePointer2 } from 'lucide-react';

export function UploadSourcesSection() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-transparent">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-16 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:pr-8 lg:pt-4"
          >
            <div className="lg:max-w-lg">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 mb-6">
                <FileUp className="h-5 w-5 text-purple-300" />
              </div>
              <h2 className="text-3xl font-display font-medium tracking-tight text-white sm:text-4xl leading-[1.1]">Upload your scattered sources</h2>
              <p className="mt-6 text-lg leading-relaxed text-neutral-400 font-light">
                Bring PDFs, notes, question papers, videos, and class material into one learning space. Cognition OS turns scattered resources into structured, interrogatable understanding.
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[400px] rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.05] to-transparent pointer-events-none" />
            
            <div className="flex-1 p-8 relative flex flex-col items-center justify-center">
               <div className="flex flex-wrap justify-center gap-4 w-full max-w-[320px] relative z-10">
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.6, delay: 0.4 }}
                   className="px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] shadow-sm flex items-center gap-3 backdrop-blur-sm"
                 >
                   <FileText className="h-5 w-5 text-purple-300" />
                   <span className="text-sm font-medium text-neutral-300">Physics_Notes.pdf</span>
                 </motion.div>
                 
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   transition={{ duration: 0.6, delay: 0.5 }}
                   className="px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] shadow-sm flex items-center gap-3 backdrop-blur-sm"
                 >
                   <Network className="h-5 w-5 text-indigo-300" />
                   <span className="text-sm font-medium text-neutral-300">Thermo_Lec.mp4</span>
                 </motion.div>
               </div>

               {/* Dropping zone */}
               <motion.div 
                 initial={{ opacity: 0 }}
                 whileInView={{ opacity: 1 }}
                 transition={{ duration: 0.8, delay: 0.8 }}
                 className="mt-8 w-full max-w-[320px] py-8 rounded-xl border border-dashed border-white/[0.15] bg-white/[0.01] text-center"
               >
                 <span className="text-sm text-neutral-400 font-light">Drop new sources here</span>
               </motion.div>
            </div>
          </motion.div>
        </div>
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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-purple-500/5 blur-[100px] rounded-[100%] pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-display font-medium tracking-tight text-white/90 sm:text-4xl"
          >
            Instant Study Intelligence
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-lg text-neutral-400 font-light"
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
              whileHover={{ y: -4 }}
              className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 flex flex-col items-center text-center overflow-hidden hover:bg-white/[0.03] transition-all duration-300 cursor-pointer"
            >
              <div className="relative z-10 w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 group-hover:border-purple-500/20 transition-colors duration-300">
                <card.icon className="h-5 w-5 text-neutral-400 group-hover:text-purple-300 transition-colors duration-300" />
              </div>
              <h3 className="text-sm font-medium text-neutral-300 group-hover:text-purple-100 transition-colors">{card.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
