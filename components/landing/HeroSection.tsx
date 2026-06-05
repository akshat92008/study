'use client';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
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
    <section className="relative pt-40 pb-32 overflow-hidden flex flex-col justify-center min-h-[90vh]">
      <GlowBackground />
      
      {/* Background Soft Ambient Pulse */}
      <motion.div 
        animate={{ opacity: [0.1, 0.15, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-purple-600/10 rounded-[100%] blur-[120px] pointer-events-none -z-10"
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl flex flex-col items-center"
        >
          <motion.div variants={itemVariants} className="mb-10 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/5 px-4 py-1.5 text-sm font-medium text-purple-200 backdrop-blur-md">
              <Sparkles className="h-4 w-4" />
              Cognition OS Beta is live
            </span>
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="font-display text-5xl sm:text-7xl lg:text-[6rem] font-medium tracking-tight text-white/95 leading-[1.05]"
          >
            Understand <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-purple-500">Anything</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="mt-8 text-xl sm:text-2xl leading-relaxed text-neutral-400 max-w-3xl mx-auto font-light">
            Your AI learning operating system. Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-12 flex items-center justify-center gap-x-6">
            <button className="group relative rounded-full bg-white text-black px-8 py-4 text-lg font-medium shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(168,85,247,0.3)] transition-all duration-300 flex items-center gap-2">
              Start Learning
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
