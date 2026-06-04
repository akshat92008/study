'use client';
import { motion, useAnimation, Variants } from 'motion/react';
import { BrainCircuit, BookOpen, Target, Sparkles, MessageSquare, Flame } from 'lucide-react';
import { GlowBackground } from './ui/GlowBackground';
import { useEffect } from 'react';

export function HeroSection() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] } }
  };

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
      <GlowBackground />
      
      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl"
        >
          <motion.div variants={itemVariants} className="mb-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm font-medium text-purple-300">
              <Sparkles className="h-4 w-4" />
              Cognition OS Beta is live
            </span>
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="font-display text-5xl font-medium tracking-tight text-white sm:text-7xl leading-tight"
          >
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">AI Learning</span> <br/> Operating System
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-6 text-lg leading-8 text-neutral-300">
            Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission. Cognition OS connects scattered notes into one intelligent learning loop.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-10 flex items-center justify-center gap-x-6">
            <div className="relative inline-block group">
              <div className="absolute -inset-2 rounded-full bg-purple-600/40 blur-xl opacity-70 group-hover:opacity-100 animate-pulse transition duration-500" />
              <button className="relative rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 hover:scale-105 transition-all duration-300 active:scale-95">
                Start Learning
              </button>
            </div>
            <button className="text-sm font-semibold leading-6 text-white hover:text-purple-300 hover:scale-105 transition-all duration-300">
              See how it works <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </button>
          </motion.div>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-20 relative mx-auto max-w-5xl group perspective-[2000px]"
        >
          <div className="rounded-xl border border-white/10 bg-[#0B0C10]/80 backdrop-blur-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[500px] transform-gpu transition-all duration-700 group-hover:shadow-[0_0_80px_rgba(168,85,247,0.15)] group-hover:border-purple-500/20">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#050608] p-4">
              <div className="flex items-center gap-2 mb-8 px-2 text-neutral-400">
                <BrainCircuit className="h-5 w-5 text-purple-500" />
                <span className="font-medium text-sm text-neutral-200">Cognition</span>
              </div>
              <div className="space-y-1">
                {[
                  { icon: Target, label: "Today's Mission", active: true },
                  { icon: BookOpen, label: "Sources" },
                  { icon: MessageSquare, label: "AI Tutor" },
                  { icon: BrainCircuit, label: "Mistake Review" },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer ${item.active ? 'bg-purple-500/20 text-purple-300 shadow-[inset_0_0_10px_rgba(168,85,247,0.1)]' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'}`}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-900/50 border border-white/5 hover:border-orange-500/30 transition-colors cursor-pointer group/streak">
                <Flame className="h-4 w-4 text-orange-500 group-hover/streak:animate-pulse" />
                <span className="text-sm text-neutral-300">12 Day Streak</span>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center relative bg-[#0B0C10]">
               <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8, duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-transparent pointer-events-none"
               />

               <div className="flex flex-col items-center gap-6 z-10 w-full max-w-md">
                 <h2 className="text-xl font-display font-medium text-white/90">Today&apos;s Mission</h2>
                 
                 {/* Animated Mission Cards */}
                 <div className="w-full space-y-3">
                   <motion.div 
                     whileHover={{ scale: 1.02 }}
                     className="w-full p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg flex justify-between items-center cursor-pointer hover:border-red-500/30 transition-colors"
                   >
                     <div className="flex items-center gap-3">
                       <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                       <span className="text-sm text-neutral-200">3 WEAK CONCEPTS FOUND</span>
                     </div>
                     <button className="text-xs text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-md hover:bg-purple-500/20 transition-colors">Review</button>
                   </motion.div>
                   
                   <motion.div 
                     whileHover={{ scale: 1.02 }}
                     className="w-full p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-lg flex justify-between items-center cursor-pointer hover:border-yellow-500/30 transition-colors"
                   >
                     <div className="flex items-center gap-3">
                       <div className="h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                       <span className="text-sm text-neutral-200">12 REVIEWS DUE</span>
                     </div>
                     <button className="text-xs text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-md hover:bg-purple-500/20 transition-colors">Start</button>
                   </motion.div>

                   <motion.div 
                     whileHover={{ scale: 1.02 }}
                     className="w-full p-4 rounded-xl border border-purple-500/40 bg-purple-500/10 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)] flex justify-between items-center cursor-pointer"
                   >
                     <div className="flex items-center gap-3">
                       <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                       <span className="text-sm text-purple-200">NEW MISSION GENERATED</span>
                     </div>
                     <button className="text-xs bg-purple-500 text-white px-4 py-1.5 rounded-md hover:bg-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all">Resume</button>
                   </motion.div>
                 </div>
               </div>

               {/* Stylized AI Typing Bubble Floating */}
               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: [0, -10, 0] }}
                 transition={{ y: { repeat: Infinity, duration: 4, ease: "easeInOut" }, opacity: { delay: 1.2, duration: 0.5 } }}
                 className="absolute bottom-10 right-10 p-4 rounded-2xl rounded-br-sm border border-purple-500/20 bg-[#1F2833]/90 backdrop-blur-xl max-w-[220px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] hidden lg:block"
               >
                 <div className="flex gap-1.5 mb-2">
                   <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                   <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                   <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                 </div>
                 <p className="text-xs text-neutral-300 leading-relaxed">&quot;I noticed you struggled with thermodynamics yesterday. Let&apos;s start with a quick conceptual review.&quot;</p>
               </motion.div>
            </div>
          </div>
          
          {/* Subtle Glow under mockup */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 rounded-2xl blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-700 -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
