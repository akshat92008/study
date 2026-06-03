'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Zap } from 'lucide-react';

interface ScoreBridgeProps {
  currentScore: number;
  recoverableMarks: number;
  chapterLoss: Array<{ chapter: string; marksLost: number }>;
  examType: string;
}

export default function ScoreBridge({
  currentScore,
  recoverableMarks,
  chapterLoss,
  examType
}: ScoreBridgeProps) {
  // Calculate total lost marks to find the true 100% potential
  const totalLost = chapterLoss.reduce((sum, c) => sum + (c.marksLost || 0), 0);
  const knowledgeGapMarks = Math.max(0, totalLost - recoverableMarks);
  
  const recoverableScore = currentScore + recoverableMarks;
  const maxPotentialScore = recoverableScore + knowledgeGapMarks;

  return (
    <div style={{
      background: 'linear-gradient(145deg, var(--bg-secondary) 0%, var(--bg-elevated) 100%)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--sp-8)',
      boxShadow: 'var(--shadow-lg), 0 0 40px hsla(220, 90%, 56%, 0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>
          {examType} Mistake Review
        </div>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)' }}>
          Score Recovery Bridge
        </h2>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--sp-4)'
      }}>
        
        {/* Node 1: Actual */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} style={{ flex: 1, minWidth: '120px', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)' }}>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>Actual Score</div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {currentScore}
            </div>
          </div>
        </motion.div>

        {/* Bridge 1: Execution Gap */}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 var(--sp-2)' }}>
          <div style={{ color: 'var(--warning)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={14} /> +{recoverableMarks}
          </div>
          <div style={{ height: 2, width: 60, background: 'var(--warning)', position: 'relative' }}>
            <ArrowRight size={16} style={{ position: 'absolute', right: -8, top: -7, color: 'var(--warning)' }} />
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', textTransform: 'uppercase', marginTop: 8, letterSpacing: 'var(--ls-wide)' }}>Execution Gap</div>
        </motion.div>

        {/* Node 2: Recoverable */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} style={{ flex: 1, minWidth: '120px', textAlign: 'center' }}>
          <div style={{ background: 'var(--warning-glow)', border: '1px solid var(--warning-dim)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', boxShadow: '0 0 20px var(--warning-glow)' }}>
            <div style={{ color: 'var(--warning)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>Recoverable</div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
              {recoverableScore}
            </div>
          </div>
        </motion.div>

        {/* Bridge 2: Knowledge Gap */}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 var(--sp-2)' }}>
          <div style={{ color: 'var(--accent-purple)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Brain size={14} /> +{knowledgeGapMarks}
          </div>
          <div style={{ height: 2, width: 60, background: 'var(--accent-purple)', position: 'relative' }}>
            <ArrowRight size={16} style={{ position: 'absolute', right: -8, top: -7, color: 'var(--accent-purple)' }} />
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '9px', textTransform: 'uppercase', marginTop: 8, letterSpacing: 'var(--ls-wide)' }}>Knowledge Gap</div>
        </motion.div>

        {/* Node 3: Potential */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }} style={{ flex: 1, minWidth: '120px', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)' }}>
            <div style={{ color: 'var(--accent-cyan)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>Max Potential</div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {maxPotentialScore}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
