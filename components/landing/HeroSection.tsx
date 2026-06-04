'use client';
import { motion } from 'framer-motion';
import { BrainCircuit, BookOpen, Target, Sparkles, MessageSquare, ArrowRight } from 'lucide-react';
import { GlowBackground } from './ui/GlowBackground';

export function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden min-h-screen flex flex-col justify-center">
      <GlowBackground />
      
      {/* Background Soft Ambient Pulse */}
      <motion.div 
        animate={{ opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-600/10 rounded-[100%] blur-[120px] pointer-events-none -z-10"
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl"
        >
          <motion.div variants={itemVariants} className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-3 py-1 text-xs font-medium text-purple-200 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              Cognition OS Beta is live
            </span>
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="font-display text-5xl sm:text-6xl lg:text-[5rem] font-medium tracking-tight text-white/95 leading-[1.05]"
          >
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-purple-400">AI Learning</span>
            <br className="hidden sm:block" /> Operating System
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-8 text-lg leading-relaxed text-neutral-400 max-w-2xl mx-auto font-light">
            Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission. Cognition OS connects scattered notes into one intelligent loop.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-10 flex items-center justify-center gap-x-6">
            <button className="group relative rounded-full bg-white text-black px-6 py-3 text-sm font-medium shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 flex items-center gap-2">
              Start Learning
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </motion.div>
        </motion.div>

        {/* Minimalist Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 relative mx-auto max-w-5xl"
        >
          <div className="rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[500px]">
            
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-60 border-r border-white/[0.05] bg-white/[0.01] p-4 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-8 px-2">
                <BrainCircuit className="h-5 w-5 text-purple-300" />
                <span className="text-sm font-medium tracking-wide text-neutral-200">Cognition</span>
              </div>
              <div className="space-y-1">
                {[
                  { icon: Target, label: "Today's Mission", active: true },
                  { icon: BookOpen, label: "Sources" },
                  { icon: MessageSquare, label: "AI Tutor" },
                  { icon: BrainCircuit, label: "Mistake Review" },
                ].map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + (i * 0.1) }}
                    key={i} 
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer ${item.active ? 'bg-purple-500/10 text-purple-200 border border-purple-500/20' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5 border border-transparent'}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center relative bg-transparent">
               <div className="flex flex-col items-center gap-8 z-10 w-full max-w-lg">
                 <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   transition={{ delay: 1 }}
                   className="text-center"
                 >
                   <h2 className="text-xl font-display font-medium text-white/90">Today's Mission</h2>
                   <p className="text-sm text-neutral-500 mt-1">Ready to close your knowledge gaps.</p>
                 </motion.div>
                 
                 {/* Minimalist Cards */}
                 <div className="w-full space-y-3">
                   {[
                     { colorClass: "bg-red-400 shadow-red-400/40", text: "3 WEAK CONCEPTS FOUND", btnClass: "text-red-300 bg-red-500/10 border-red-500/20 hover:bg-red-500/20", btn: "Review", delay: 1.0 },
                     { colorClass: "bg-amber-400 shadow-amber-400/40", text: "12 REVIEWS DUE", btnClass: "text-amber-300 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20", btn: "Start", delay: 1.1 },
                     { colorClass: "bg-purple-400 shadow-purple-400/60", text: "NEW MISSION GENERATED", btnClass: "bg-purple-500/80 text-white border-transparent hover:bg-purple-500", btn: "Resume", delay: 1.2, active: true }
                   ].map((card, idx) => (
                     <motion.div 
                       key={idx}
                       initial={{ opacity: 0, y: 15 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: card.delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                       className={`w-full p-4 rounded-xl border flex justify-between items-center cursor-pointer transition-all duration-300 ${
                         card.active 
                         ? "border-purple-500/30 bg-purple-500/5 shadow-[0_4px_24px_rgba(168,85,247,0.1)]" 
                         : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                       }`}
                     >
                       <div className="flex items-center gap-3">
                         <div className={`h-2 w-2 rounded-full ${card.colorClass} shadow-md`} />
                         <span className={`text-xs font-medium tracking-wide ${card.active ? 'text-purple-100' : 'text-neutral-300'}`}>{card.text}</span>
                       </div>
                       <button className={`text-[11px] px-3 py-1.5 rounded-md font-medium border transition-colors ${card.btnClass}`}>
                         {card.btn}
                       </button>
                     </motion.div>
                   ))}
                 </div>
               </div>

               {/* Elegant AI Note */}
               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 1.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                 className="absolute bottom-6 right-6 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md hidden md:block max-w-[240px]"
               >
                 <div className="flex gap-2 items-center mb-2">
                   <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                   <span className="text-xs font-medium text-purple-200">AI Tutor</span>
                 </div>
                 <p className="text-xs text-neutral-400 leading-relaxed font-light">"I noticed you struggled with thermodynamics yesterday. Let's start with a quick conceptual review."</p>
               </motion.div>
            </div>
          </div>
          
          <div className="absolute -inset-4 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-[2rem] blur-2xl opacity-50 -z-10 pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}
