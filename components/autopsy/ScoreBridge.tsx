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
    <div style={{ padding: 'var(--sp-6)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
      <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', color: 'var(--text-primary)' }}>
        Score Recovery Potential
      </h3>
      
      <div style={{ position: 'relative', height: '40px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex', marginBottom: 'var(--sp-4)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${currentPercentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ background: 'var(--accent-cyan)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-inverse)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-sm)' }}
        >
          {currentScore > 0 && currentScore}
        </motion.div>
        
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${recoverablePercentage}%` }}
          transition={{ duration: 1, delay: 1, ease: 'easeOut' }}
          style={{ background: 'var(--success)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-inverse)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-xs)', backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)', backgroundSize: '1rem 1rem' }}
        >
          +{recoverableMarks}
        </motion.div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Actual Score</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{currentScore}</div>
        </div>
        
        <ArrowRight color="var(--text-secondary)" />
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Potential Score</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--success)' }}>{potentialScore}</div>
        </div>
      </div>
    </div>
  );
}
