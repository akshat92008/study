'use client';
import { motion } from 'framer-motion';
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
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
  };

  const steps = [
    {
      title: "Question Diagnosis",
      description: "Mark your mistakes and input your thought process.",
      icon: Stethoscope,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      title: "Root Cause Analysis",
      description: "AI tutor identifies the exact conceptual gap in your reasoning.",
      icon: AlertCircle,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20"
    },
    {
      title: "Memory Integration",
      description: "The mistake is linked to your personalized knowledge graph.",
      icon: Search,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20"
    },
    {
      title: "Comeback Plan",
      description: "Dynamically modifies your next mission with targeted drills.",
      icon: RefreshCw,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20"
    }
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden bg-[#050608]">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-orange-600/5 rounded-[100%] blur-[150px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="mx-auto max-w-3xl text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="w-full mb-8"
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#1F2833] to-black border border-orange-500/30 shadow-[0_0_40px_rgba(249,115,22,0.15)]" style={{ margin: '0 auto' }}>
              <Stethoscope className="h-8 w-8 text-orange-400" />
            </div>
          </motion.div>
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
            className="mt-6 text-xl text-neutral-400 leading-relaxed font-light"
          >
            Cognition OS doesn't just mark mistakes. It investigates them. Every wrong answer becomes a diagnosis, a memory, and a comeback plan.
          </motion.p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {steps.map((step, idx) => (
            <motion.div 
              key={idx}
              variants={cardVariants}
              className="relative rounded-2xl border border-white/[0.06] bg-black/40 backdrop-blur-xl p-8 transition-all hover:bg-white/[0.02] flex flex-col items-center text-center group"
            >
              <div className={`h-14 w-14 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110`}>
                <step.icon className={`h-6 w-6 ${step.color}`} />
              </div>
              <h3 className="text-lg font-medium text-white mb-3">{step.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
