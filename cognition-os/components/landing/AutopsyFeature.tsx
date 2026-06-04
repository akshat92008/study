'use client';
import { motion } from 'motion/react';
import { Stethoscope, CheckCircle, Search, AlertCircle, RefreshCw } from 'lucide-react';

export function AutopsyFeature() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100, damping: 15 } }
  };

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[#030014]">
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <div className="h-16 w-16 mx-auto flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#1F2833] to-[#0B0C10] border border-orange-500/30 mb-8 shadow-[0_0_40px_rgba(249,115,22,0.15)] glow-effect">
            <Stethoscope className="h-8 w-8 text-orange-400" />
          </div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-4xl font-display font-medium tracking-tight text-white sm:text-5xl"
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
            Cognition OS does not just mark mistakes. It investigates them. Every wrong answer becomes a diagnosis, memory, and comeback plan.
          </motion.p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Main Question Mock Card (Spans 2 columns) */}
          <motion.div 
            variants={cardVariants}
            className="md:col-span-2 row-span-2 relative rounded-3xl border border-white/10 bg-[#0B0C10]/80 backdrop-blur-xl p-8 overflow-hidden shadow-2xl group hover:border-red-500/30 transition-all duration-500"
          >
            <div className="absolute top-0 right-0 p-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500" />
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <h4 className="text-xl font-display font-medium text-white">Question Diagnosis</h4>
                  <span className="text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.2)]">Score: 0/4</span>
                </div>
                <div className="p-6 rounded-2xl bg-[#1F2833]/50 border border-white/5 mb-6">
                   <p className="text-base text-neutral-300 leading-relaxed">Calculate the enthalpy change for the reaction forming 2 moles of NH3. Given standard enthalpies of formation...</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <div className="w-10 h-10 rounded-lg bg-[#0B0C10] border border-red-500/30 flex items-center justify-center text-red-400 text-lg font-bold shadow-[0_0_10px_rgba(239,68,68,0.2)]">-120 kJ</div>
                  <span className="text-sm font-medium text-red-200">Your Answer (Incorrect)</span>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <div className="w-10 h-10 rounded-lg bg-[#0B0C10] border border-green-500/30 flex items-center justify-center text-green-400 text-lg font-bold shadow-[0_0_10px_rgba(74,222,128,0.2)]">-92.4 kJ</div>
                  <span className="text-sm font-medium text-green-200">Correct Answer</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Root Cause Card */}
          <motion.div 
            variants={cardVariants}
            className="md:col-span-1 rounded-3xl border border-white/10 bg-[#0B0C10]/80 backdrop-blur-xl p-8 shadow-xl group hover:border-orange-500/30 transition-all duration-500 relative overflow-hidden"
          >
             <div className="absolute -bottom-10 -right-10 p-20 bg-orange-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-colors" />
             <div className="relative z-10 flex flex-col h-full">
               <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                 <AlertCircle className="h-6 w-6 text-orange-400" />
               </div>
               <h3 className="text-lg font-medium text-white mb-2">Root Cause Found</h3>
               <p className="text-sm text-neutral-400 leading-relaxed mb-6">Cognition identified a conceptual gap in your understanding of Hess&apos;s Law sign conventions.</p>
               <div className="mt-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-300 text-xs font-semibold border border-orange-500/20">
                 Concept Gap
               </div>
             </div>
          </motion.div>

          {/* Memory Integration Card */}
          <motion.div 
            variants={cardVariants}
            className="md:col-span-1 rounded-3xl border border-white/10 bg-[#1F2833]/80 backdrop-blur-xl p-8 shadow-xl group hover:border-purple-500/30 transition-all duration-500 relative overflow-hidden"
          >
             <div className="absolute -top-10 -left-10 p-20 bg-purple-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-colors" />
             <div className="relative z-10">
               <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                 <Search className="h-6 w-6 text-purple-400" />
               </div>
               <h3 className="text-lg font-medium text-white mb-2">Memory Updated</h3>
               <p className="text-sm text-neutral-400 leading-relaxed italic border-l-2 border-purple-500/30 pl-4 py-1">
                 &quot;AI Tutor has recorded this mistake and linked it to your Thermodynamics knowledge map.&quot;
               </p>
             </div>
          </motion.div>

          {/* Comeback Plan Card (Spans full width below) */}
          <motion.div 
            variants={cardVariants}
            className="md:col-span-3 rounded-3xl border border-purple-500/20 bg-gradient-to-r from-[#0B0C10] to-[#1F2833] backdrop-blur-xl p-8 shadow-2xl flex flex-col sm:flex-row items-center sm:items-stretch gap-6 group hover:border-purple-500/50 transition-all duration-500"
          >
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.2)] group-hover:shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-shadow">
              <RefreshCw className="h-8 w-8 text-purple-400 group-hover:rotate-180 transition-transform duration-700 ease-in-out" />
            </div>
            <div className="flex-1 flex flex-col justify-center text-center sm:text-left">
              <h3 className="text-xl font-display font-medium text-white mb-2">Comeback Plan Generated</h3>
              <p className="text-sm text-neutral-300">Your next mission has been modified to include a targeted 5-question drill on Hess&apos;s Law to solidify the concept.</p>
            </div>
            <div className="flex items-center">
              <button className="px-6 py-3 rounded-full bg-purple-600/20 text-purple-300 font-medium text-sm border border-purple-500/30 hover:bg-purple-600 hover:text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-105 active:scale-95">
                View Mission
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
