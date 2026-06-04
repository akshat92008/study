'use client';
import { motion, useScroll, useTransform, useInView } from 'motion/react';
import { FileUp, FileText, Zap, Brain, Crosshair, Network, BarChart, MousePointer2 } from 'lucide-react';
import { useRef } from 'react';

export function UploadSourcesSection() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[#030014]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8" ref={containerRef}>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-16 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="lg:pr-8 lg:pt-4"
          >
            <div className="lg:max-w-lg">
              <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-8 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <FileUp className="h-6 w-6 text-purple-400" />
              </div>
              <h2 className="text-3xl font-display font-medium tracking-tight text-white sm:text-5xl leading-tight">Upload your <br/> scattered sources</h2>
              <p className="mt-6 text-lg leading-relaxed text-neutral-400">
                Bring PDFs, notes, question papers, videos, and class material into one learning space. Cognition OS turns scattered resources into structured, interrogatable understanding.
              </p>
              <div className="mt-8 flex gap-4">
                <button className="rounded-full bg-[#1F2833] border border-white/10 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-white/10 hover:border-white/20 transition-all hover:scale-105 active:scale-95">
                  View Demo
                </button>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 50, rotateX: 10 }}
            animate={isInView ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: 10 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="relative h-[450px] rounded-2xl bg-[#0B0C10]/80 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden perspective-[1000px] group"
          >
            {/* OSX style window header */}
            <div className="h-12 border-b border-white/5 bg-black/40 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>
              <div className="mx-auto px-4 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-neutral-500 flex items-center font-mono">
                app.cognition.os / sources
              </div>
            </div>
            
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="flex-1 p-6 relative flex flex-col items-center justify-center">
               <div className="grid grid-cols-2 gap-4 w-full max-w-[300px] relative z-10">
                 <motion.div
                   animate={{ y: [0, -5, 0] }}
                   transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                   className="p-4 rounded-xl bg-[#1F2833] border border-white/10 shadow-lg flex flex-col items-center gap-3 hover:border-blue-500/30 transition-colors"
                 >
                   <FileText className="h-8 w-8 text-blue-400" />
                   <span className="text-xs font-medium text-neutral-300">Physics_Notes.pdf</span>
                 </motion.div>
                 
                 <motion.div
                   animate={{ y: [0, 5, 0] }}
                   transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                   className="p-4 rounded-xl bg-[#1F2833] border border-white/10 shadow-lg flex flex-col items-center gap-3 hover:border-red-500/30 transition-colors"
                 >
                   <Network className="h-8 w-8 text-red-400" />
                   <span className="text-xs font-medium text-neutral-300">Thermo_Lec.mp4</span>
                 </motion.div>
               </div>

               {/* Simulated dropping zone */}
               <motion.div 
                 initial={{ borderColor: 'rgba(255,255,255,0.1)' }}
                 animate={{ borderColor: ['rgba(255,255,255,0.1)', 'rgba(168,85,247,0.5)', 'rgba(255,255,255,0.1)'] }}
                 transition={{ repeat: Infinity, duration: 3, delay: 1.5 }}
                 className="mt-6 w-full max-w-[300px] p-6 rounded-xl border-2 border-dashed bg-purple-500/5 text-center transition-colors"
               >
                 <span className="text-sm text-purple-300/80 font-medium">Drop new sources here</span>
               </motion.div>

               {/* Simulated Cursor */}
               <motion.div
                 initial={{ x: 50, y: 150, opacity: 0 }}
                 animate={{ 
                   x: [50, -50, -50, 50], 
                   y: [150, 0, 0, 150],
                   opacity: [0, 1, 1, 0]
                 }}
                 transition={{ repeat: Infinity, duration: 6, times: [0, 0.3, 0.7, 1] }}
                 className="absolute z-50 pointer-events-none"
               >
                 <MousePointer2 className="h-6 w-6 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] fill-black" />
               </motion.div>
               
               {/* Click feedback simple ripple */}
               <motion.div
                 initial={{ scale: 0, opacity: 0 }}
                 animate={{ scale: [0, 2], opacity: [0, 0.8, 0] }}
                 transition={{ repeat: Infinity, duration: 6, times: [0, 1], delay: 1.8 }}
                 className="absolute top-[40%] left-[30%] w-8 h-8 rounded-full bg-purple-500 -ml-4 -mt-4 pointer-events-none"
               />
            </div>
            <div className="absolute -inset-px rounded-2xl pointer-events-none border border-white/5 group-hover:border-purple-500/20 transition-colors duration-500" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function StudyIntelligenceSection() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  const cards = [
    { title: "Study Guide", icon: FileText, delay: 0 },
    { title: "Flashcards", icon: Zap, delay: 0.1 },
    { title: "Formula Sheet", icon: BarChart, delay: 0.2 },
    { title: "MCQ Practice", icon: Crosshair, delay: 0.3 },
    { title: "Concept Map", icon: Network, delay: 0.4 },
    { title: "Revision Queue", icon: Brain, delay: 0.5 },
  ];

  return (
    <section className="py-32 relative overflow-hidden bg-[#030014] border-y border-white/5">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10" ref={containerRef}>
        <div className="mx-auto max-w-2xl text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl"
          >
            Instant Study Intelligence
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-lg text-neutral-400"
          >
            Generate study guides, flashcards, formula sheets, practice sets, and revision plans from your own material with one click.
          </motion.p>
        </div>
        
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-3 lg:gap-8">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
              transition={{ delay: card.delay, type: "spring", stiffness: 100, damping: 20 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative rounded-3xl border border-white/10 bg-[#0B0C10] p-8 flex flex-col items-center text-center overflow-hidden shadow-xl hover:shadow-[0_20px_40px_rgba(168,85,247,0.15)] hover:border-purple-500/30 transition-all duration-300 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/10 group-hover:to-transparent transition-all duration-500" />
              
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#1F2833] border border-white/5 flex items-center justify-center mb-6 group-hover:bg-purple-500/10 group-hover:border-purple-500/30 transition-colors duration-300">
                <card.icon className="h-8 w-8 text-neutral-400 group-hover:text-purple-400 transition-colors duration-300" />
              </div>
              <h3 className="text-base font-medium text-white group-hover:text-purple-200 transition-colors">{card.title}</h3>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
