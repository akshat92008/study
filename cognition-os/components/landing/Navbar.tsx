'use client';
import { motion } from 'motion/react';
import { BrainCircuit, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#030014]/60 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-purple-500" />
          <span className="font-display font-medium tracking-tight text-white">Cognition OS</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#method" className="hover:text-white transition-colors">Method</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-neutral-300 hover:text-white hidden sm:block">
            Sign In
          </Link>
          <button className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/20 hover:bg-white/20 transition-all">
            Launch App
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
