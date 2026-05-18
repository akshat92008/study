'use client';

import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import { Trophy, Flame, Clock, BarChart3 } from 'lucide-react';

interface SessionCompleteProps {
  cardsReviewed: number;
  correctCount: number;
  sessionMinutes: number;
  streak: number;
  nextSessionDate: string | null;
  onClose: () => void;
}

export default function SessionComplete({
  cardsReviewed, correctCount, sessionMinutes, streak, nextSessionDate, onClose,
}: SessionCompleteProps) {
  const accuracy = cardsReviewed > 0 ? Math.round((correctCount / cardsReviewed) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'var(--sp-6)', maxWidth: 480, margin: '0 auto', padding: 'var(--sp-8) 0',
      }}
    >
      {/* Celebration */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
        style={{
          width: 80, height: 80, borderRadius: 'var(--radius-full)',
          background: 'var(--success-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-success)',
        }}
      >
        <Trophy size={36} style={{ color: 'var(--success)' }} />
      </motion.div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-1)' }}>
          Session Complete!
        </h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
          Your memory just got stronger. Keep showing up.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)', width: '100%' }}>
        {[
          { icon: BarChart3, label: 'Cards Reviewed', value: cardsReviewed, color: 'var(--accent-blue)' },
          { icon: Trophy, label: 'Accuracy', value: `${accuracy}%`, color: accuracy >= 80 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--danger)' },
          { icon: Clock, label: 'Time Spent', value: `${sessionMinutes}m`, color: 'var(--text-secondary)' },
          { icon: Flame, label: 'Streak', value: `${streak} days`, color: 'var(--warning)' },
        ].map((stat) => (
          <Card key={stat.label} padding="md" style={{ textAlign: 'center' }}>
            <stat.icon size={18} style={{ color: stat.color, margin: '0 auto var(--sp-2)' }} />
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
              {stat.label}
            </div>
          </Card>
        ))}
      </div>

      {/* Next session */}
      {nextSessionDate && (
        <Card padding="md" style={{ width: '100%', textAlign: 'center', borderLeft: '3px solid var(--accent-purple)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>
            Next Review
          </div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--accent-purple)' }}>
            {new Date(nextSessionDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </Card>
      )}

      <button
        onClick={onClose}
        style={{
          padding: 'var(--sp-3) var(--sp-8)', borderRadius: 'var(--radius-md)',
          background: 'var(--accent-blue)', color: 'var(--text-inverse)',
          border: 'none', cursor: 'pointer', fontWeight: 'var(--fw-bold)',
          fontSize: 'var(--fs-base)',
        }}
      >
        Done
      </button>
    </motion.div>
  );
}
