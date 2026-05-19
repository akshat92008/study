'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface ScoreBridgeProps {
  currentScore: number;
  potentialScore: number;
  recoverableMarks: number;
  maxScore?: number;
}

export default function ScoreBridge({ currentScore, potentialScore, recoverableMarks, maxScore = 720 }: ScoreBridgeProps) {
  const currentPercentage = (currentScore / maxScore) * 100;
  const recoverablePercentage = (recoverableMarks / maxScore) * 100;

  return (
    <div style={{ padding: 'var(--sp-6)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-purple-dim)', boxShadow: 'var(--shadow-glow-purple)' }}>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', color: 'var(--text-primary)' }}>
        Recoverable Score Potential
      </h3>
      
      <div style={{ position: 'relative', height: '48px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', marginBottom: 'var(--sp-4)' }}>
        {/* Actual Score Bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${currentPercentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: 'var(--accent-cyan)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-inverse)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-sm)', borderRight: '2px solid var(--bg-root)' }}
        >
          {currentScore > 0 && currentScore}
        </motion.div>
        
        {/* Recoverable Marks Bar (Striped/Glowing) */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${recoverablePercentage}%` }}
          transition={{ duration: 1, delay: 0.8, ease: 'easeOut' }}
          style={{ 
            background: 'var(--success)', 
            height: '100%', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: 'var(--text-inverse)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-sm)',
            backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', 
            backgroundSize: '1rem 1rem',
            boxShadow: '0 0 10px var(--success-glow)'
          }}
        >
          +{recoverableMarks}
        </motion.div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>Actual Score</div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{currentScore}</div>
        </div>
        
        <ArrowRight color="var(--text-tertiary)" size={24} />
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>Potential Score</div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{potentialScore}</div>
        </div>
      </div>
    </div>
  );
}
