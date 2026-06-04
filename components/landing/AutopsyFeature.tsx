'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, CheckCircle, Search, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AutopsyFeature() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 3500); // Progress every 3.5 seconds
    return () => clearInterval(timer);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 90, damping: 20 } }
  };

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[#050608]">
      {/* Background ambient light */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-2xl text-center mb-20">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="h-16 w-16 mx-auto flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#1F2833] to-black border border-orange-500/40 mb-8 shadow-[0_0_50px_rgba(249,115,22,0.2)]"
          >
            <Stethoscope className="h-8 w-8 text-orange-400" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl drop-shadow-lg"
          >
            Autopsy your mistakes
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-lg text-neutral-400 leading-relaxed max-w-xl mx-auto"
          >
            Cognition OS doesn't just mark mistakes. It investigates them. Every wrong answer becomes a diagnosis, memory, and comeback plan.
          </motion.p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Step 1: Question Diagnosis (Main Card) */}
          <motion.div 
            variants={cardVariants}
            className={`md:col-span-2 row-span-2 relative rounded-3xl border ${step === 0 ? 'border-red-500/50 shadow-[0_0_60px_rgba(239,68,68,0.15)]' : 'border-white/10 shadow-2xl'} bg-black/60 backdrop-blur-2xl p-8 overflow-hidden transition-all duration-700 group hover:border-red-500/30`}
          >
            <div className="absolute top-0 right-0 p-32 bg-red-600/10 blur-3xl rounded-full pointer-events-none transition-colors duration-500" />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h4 className="text-xl font-display font-medium text-white flex items-center gap-2">
                    <motion.div animate={step === 0 ? { scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] } : {}} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 rounded-full bg-red-500" />
                    Question Diagnosis
                  </h4>
                  <span className="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.3)]">Score: 0/4</span>
                </div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
                   <p className="text-base text-neutral-300 leading-relaxed">Calculate the enthalpy change for the reaction forming 2 moles of NH3. Given standard enthalpies of formation...</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key="wrong"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-black border border-red-500/40 flex items-center justify-center text-red-400 text-lg font-bold shadow-[0_0_15px_rgba(239,68,68,0.3)]">-120 kJ</div>
                    <span className="text-sm font-medium text-red-200">Your Answer (Incorrect)</span>
                  </motion.div>
                </AnimatePresence>
                
                {step >= 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20 opacity-60"
                  >
                    <div className="w-10 h-10 rounded-lg bg-black border border-green-500/20 flex items-center justify-center text-green-400 text-lg font-bold">-92.4 kJ</div>
                    <span className="text-sm font-medium text-green-200/50">Correct Answer</span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Step 2: Root Cause Card */}
          <motion.div 
            variants={cardVariants}
            className={`md:col-span-1 rounded-3xl border ${step === 1 ? 'border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.2)]' : 'border-white/10'} bg-black/60 backdrop-blur-2xl p-8 transition-all duration-700 relative overflow-hidden group`}
          >
             <div className="absolute -bottom-10 -right-10 p-24 bg-orange-600/10 blur-3xl rounded-full pointer-events-none transition-colors" />
             <div className="relative z-10 flex flex-col h-full">
               <div className={`h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(249,115,22,0.15)] ${step === 1 ? 'animate-pulse' : ''}`}>
                 <AlertCircle className="h-6 w-6 text-orange-400" />
               </div>
               <h3 className="text-lg font-medium text-white mb-2">Root Cause</h3>
               
               <AnimatePresence mode="wait">
                 {step >= 1 ? (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col h-full">
                     <p className="text-sm text-neutral-400 leading-relaxed mb-6">Cognition identified a conceptual gap in your understanding of Hess's Law sign conventions.</p>
                     <div className="mt-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 text-xs font-semibold border border-orange-500/30 w-fit">
                       Concept Gap Detected
                     </div>
                   </motion.div>
                 ) : (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-neutral-500 text-sm mt-4">
                     <div className="h-4 w-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
                     Analyzing...
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </motion.div>

          {/* Step 3: Memory Integration Card */}
          <motion.div 
            variants={cardVariants}
            className={`md:col-span-1 rounded-3xl border ${step === 2 ? 'border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.2)]' : 'border-white/10'} bg-black/60 backdrop-blur-2xl p-8 transition-all duration-700 relative overflow-hidden group`}
          >
             <div className="absolute -top-10 -left-10 p-24 bg-purple-600/10 blur-3xl rounded-full pointer-events-none transition-colors" />
             <div className="relative z-10 flex flex-col h-full">
               <div className={`h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(168,85,247,0.15)] ${step === 2 ? 'animate-pulse' : ''}`}>
                 <Search className="h-6 w-6 text-purple-400" />
               </div>
               <h3 className="text-lg font-medium text-white mb-2">Memory Updated</h3>
               
               <AnimatePresence mode="wait">
                 {step >= 2 ? (
                   <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col h-full">
                     <p className="text-sm text-neutral-400 leading-relaxed italic border-l-2 border-purple-500/50 pl-4 py-1 bg-gradient-to-r from-purple-500/5 to-transparent rounded-r-lg">
                       "AI Tutor has recorded this mistake and linked it to your Thermodynamics knowledge map."
                     </p>
                   </motion.div>
                 ) : (
                   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-neutral-500 text-sm mt-4">
                     Waiting for root cause...
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </motion.div>

          {/* Step 4: Comeback Plan Card (Spans full width) */}
          <motion.div 
            variants={cardVariants}
            className={`md:col-span-3 rounded-3xl border ${step === 3 ? 'border-indigo-500/50 shadow-[0_0_50px_rgba(99,102,241,0.2)] bg-gradient-to-r from-[#0f111a] to-[#1a1c29]' : 'border-white/10 bg-black/60'} backdrop-blur-2xl p-8 flex flex-col sm:flex-row items-center sm:items-stretch gap-6 transition-all duration-700 relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            
            <div className={`h-16 w-16 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center z-10 transition-shadow ${step === 3 ? 'shadow-[0_0_40px_rgba(99,102,241,0.4)]' : ''}`}>
              <RefreshCw className={`h-8 w-8 text-indigo-400 ${step === 3 ? 'animate-spin-slow' : ''}`} />
            </div>
            
            <div className="flex-1 flex flex-col justify-center text-center sm:text-left z-10">
              <h3 className="text-xl font-display font-medium text-white mb-2">Comeback Plan</h3>
              <AnimatePresence mode="wait">
                 {step === 3 ? (
                   <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-neutral-300 max-w-2xl">
                     Your next mission has been dynamically modified to include a targeted 5-question drill on <span className="text-indigo-300 font-medium">Hess's Law</span> to solidify the concept.
                   </motion.p>
                 ) : (
                   <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-neutral-500">
                     Awaiting diagnosis completion to generate a recovery strategy...
                   </motion.p>
                 )}
               </AnimatePresence>
            </div>
            
            <div className="flex items-center z-10">
              <button className={`px-6 py-3 rounded-full font-medium text-sm border transition-all flex items-center gap-2 ${
                step === 3 
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500 hover:text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]' 
                : 'bg-white/5 text-neutral-500 border-white/10 cursor-not-allowed'
              }`}>
                View Mission <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
