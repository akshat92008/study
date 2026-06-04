'use client';
import { motion } from 'framer-motion';
import { BrainCircuit, BookOpen, Target, Sparkles, MessageSquare, Flame } from 'lucide-react';
import { GlowBackground } from './ui/GlowBackground';

export function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] } }
  };

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden min-h-screen flex flex-col justify-center">
      <GlowBackground />
      
      {/* Background Deep Purple Pulse */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none -z-10"
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl"
        >
          <motion.div variants={itemVariants} className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-300 backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              Cognition OS Beta is live
            </span>
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] drop-shadow-2xl"
          >
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-indigo-500 animate-gradient-x">AI Learning</span> Operating System
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-6 text-lg leading-8 text-neutral-300">
            Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission. Cognition OS connects scattered notes into one intelligent learning loop.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-10 flex items-center justify-center gap-x-6">
            <div className="relative inline-block group cursor-pointer">
              {/* Animated Outline on Hover */}
              <div className="absolute -inset-[2px] rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 opacity-0 group-hover:opacity-100 transition duration-500 blur-sm group-hover:animate-pulse" />
              <div className="absolute -inset-2 rounded-full bg-purple-600/40 blur-xl opacity-70 group-hover:opacity-100 transition duration-500" />
              <button className="relative rounded-full bg-[#0B0C10] border border-purple-500/30 px-8 py-4 text-sm font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:shadow-[0_0_60px_rgba(168,85,247,0.5)] transition-all duration-300 overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">Start Learning <Target className="w-4 h-4" /></span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Dynamic Animated Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 100, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.5, delay: 0.4, type: "spring", bounce: 0.2 }}
          style={{ perspective: 2000 }}
          className="mt-24 relative mx-auto max-w-5xl group"
        >
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[550px] transform-gpu transition-all duration-700 hover:border-purple-500/40 hover:shadow-[0_0_100px_rgba(168,85,247,0.2)]">
            
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-64 border-r border-white/5 bg-black/60 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 mb-10 px-2 relative z-10">
                <div className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                  <BrainCircuit className="h-5 w-5 text-purple-400" />
                </div>
                <span className="font-semibold tracking-wide text-neutral-100">Cognition</span>
              </div>
              <div className="space-y-2 relative z-10">
                {[
                  { icon: Target, label: "Today's Mission", active: true },
                  { icon: BookOpen, label: "Sources" },
                  { icon: MessageSquare, label: "AI Tutor" },
                  { icon: BrainCircuit, label: "Mistake Review" },
                ].map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + (i * 0.1) }}
                    key={i} 
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 cursor-pointer ${item.active ? 'bg-purple-500/15 text-purple-200 border border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.15)]' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border border-transparent'}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center relative bg-gradient-to-br from-[#0B0C10] to-[#1a1325]">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15),transparent_60%)] pointer-events-none" />

               <div className="flex flex-col items-center gap-6 z-10 w-full max-w-lg">
                 <motion.h2 
                   initial={{ opacity: 0, y: -10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 1 }}
                   className="text-2xl font-display font-medium text-white/90 drop-shadow-md"
                 >
                   Today&apos;s Mission
                 </motion.h2>
                 
                 {/* Sequenced Mission Cards */}
                 <div className="w-full space-y-4">
                   {[
                     { color: "red", text: "3 WEAK CONCEPTS FOUND", btn: "Review", delay: 1.2 },
                     { color: "yellow", text: "12 REVIEWS DUE", btn: "Start", delay: 1.4 },
                     { color: "green", text: "NEW MISSION GENERATED", btn: "Resume", delay: 1.6, active: true }
                   ].map((card, idx) => (
                     <motion.div 
                       key={idx}
                       initial={{ opacity: 0, y: 30, scale: 0.95 }}
                       animate={{ opacity: 1, y: 0, scale: 1 }}
                       transition={{ delay: card.delay, type: "spring", stiffness: 100 }}
                       whileHover={{ scale: 1.02, y: -2 }}
                       className={`w-full p-4 rounded-xl border backdrop-blur-xl shadow-xl flex justify-between items-center cursor-pointer transition-all duration-300 ${
                         card.active 
                         ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_30px_rgba(168,85,247,0.2)]" 
                         : "border-white/10 bg-white/5 hover:bg-white/10"
                       }`}
                     >
                       <div className="flex items-center gap-3">
                         <div className={`h-2.5 w-2.5 rounded-full bg-${card.color}-500 shadow-[0_0_10px_var(--tw-shadow-color)] shadow-${card.color}-500/80 animate-pulse`} />
                         <span className={`text-sm font-medium ${card.active ? 'text-purple-100' : 'text-neutral-200'}`}>{card.text}</span>
                       </div>
                       <button className={`text-xs px-4 py-1.5 rounded-md font-medium transition-all ${
                         card.active 
                         ? "bg-purple-500 text-white hover:bg-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.6)]" 
                         : `text-${card.color}-400 bg-${card.color}-500/10 hover:bg-${card.color}-500/20 border border-${card.color}-500/20`
                       }`}>{card.btn}</button>
                     </motion.div>
                   ))}
                 </div>
               </div>

               {/* AI Typing Bubble - Slides in dynamically */}
               <motion.div
                 initial={{ opacity: 0, x: 50, scale: 0.9 }}
                 animate={{ opacity: 1, x: 0, scale: 1 }}
                 transition={{ delay: 2, type: "spring", stiffness: 120 }}
                 className="absolute bottom-8 right-8 p-5 rounded-2xl rounded-br-sm border border-purple-500/30 bg-black/80 backdrop-blur-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] hidden md:block max-w-[260px] z-20 group/bubble"
               >
                 <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover/bubble:opacity-100 transition-opacity" />
                 <div className="flex gap-1.5 mb-3">
                   {[0, 1, 2].map((i) => (
                     <motion.div 
                       key={i}
                       animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} 
                       transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.2 }} 
                       className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" 
                     />
                   ))}
                 </div>
                 <p className="text-xs text-neutral-200 leading-relaxed font-medium">&quot;I noticed you struggled with thermodynamics yesterday. Let's start with a quick conceptual review.&quot;</p>
               </motion.div>
            </div>
          </div>
          
          {/* External Ambient Glow */}
          <div className="absolute -inset-6 bg-gradient-to-tr from-purple-600/30 via-pink-600/20 to-indigo-600/30 rounded-[2rem] blur-3xl opacity-0 group-hover:opacity-60 transition-opacity duration-1000 -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
