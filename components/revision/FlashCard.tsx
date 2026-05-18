'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

interface FlashCardProps {
  front: string;
  back: string;
  cardIndex: number;
  totalCards: number;
  onRate: (rating: 'again' | 'hard' | 'good' | 'easy') => void;
}

const RATINGS = [
  { key: 'again' as const, label: 'Again', shortcut: '1', color: 'var(--danger)', bg: 'var(--danger-dim)' },
  { key: 'hard' as const, label: 'Hard', shortcut: '2', color: 'var(--warning)', bg: 'var(--warning-dim)' },
  { key: 'good' as const, label: 'Good', shortcut: '3', color: 'var(--success)', bg: 'var(--success-dim)' },
  { key: 'easy' as const, label: 'Easy', shortcut: '4', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-dim)' },
];

export default function FlashCard({ front, back, cardIndex, totalCards, onRate }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  // Reset flip state when card changes
  useEffect(() => { setFlipped(false); }, [front]);

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setFlipped(prev => !prev);
    }
    if (flipped) {
      if (e.key === '1') { setFlipped(false); onRate('again'); }
      if (e.key === '2') { setFlipped(false); onRate('hard'); }
      if (e.key === '3') { setFlipped(false); onRate('good'); }
      if (e.key === '4') { setFlipped(false); onRate('easy'); }
    }
  }, [flipped, onRate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const progressPct = totalCards > 0 ? Math.round(((cardIndex) / totalCards) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', width: '100%', maxWidth: 640, margin: '0 auto' }}>

      {/* Progress indicator */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div style={{ flex: 1, height: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.4 }}
            style={{ height: '100%', background: 'var(--accent-blue)', borderRadius: 'var(--radius-full)' }}
          />
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {cardIndex + 1} / {totalCards}
        </span>
      </div>

      {/* Card with 3D flip */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        style={{
          width: '100%', minHeight: 320, perspective: 1000,
          cursor: flipped ? 'default' : 'pointer',
        }}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%', height: '100%', position: 'relative',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Front Face */}
          <Card padding="lg" style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 320, textAlign: 'center',
            border: '1px solid var(--border-default)',
          }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-medium)', lineHeight: 'var(--lh-relaxed)', padding: 'var(--sp-4)' }}>
              {front}
            </div>
            <div style={{ marginTop: 'var(--sp-6)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
              <RotateCcw size={12} /> Tap or press Space to reveal
            </div>
          </Card>

          {/* Back Face */}
          <Card padding="lg" style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: 320, textAlign: 'center',
            border: '1px solid var(--accent-purple)',
            background: 'var(--bg-elevated)',
          }}>
            <div style={{
              fontSize: 'var(--fs-xs)', color: 'var(--accent-purple)', fontWeight: 'var(--fw-semibold)',
              textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-3)',
            }}>
              Answer
            </div>
            <div style={{ fontSize: 'var(--fs-md)', lineHeight: 'var(--lh-relaxed)', color: 'var(--text-primary)', padding: 'var(--sp-4)' }}>
              {back}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Rating Buttons (visible after flip) */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{ display: 'flex', gap: 'var(--sp-2)', width: '100%' }}
          >
            {RATINGS.map((r) => (
              <button
                key={r.key}
                onClick={() => { setFlipped(false); onRate(r.key); }}
                style={{
                  flex: 1, padding: 'var(--sp-3) var(--sp-4)',
                  background: r.bg, border: `1px solid ${r.color}44`,
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-1)',
                  transition: 'all 150ms ease',
                }}
              >
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: r.color }}>
                  {r.label}
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {r.shortcut}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
