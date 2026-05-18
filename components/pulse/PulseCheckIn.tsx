'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MOODS = [
  { emoji: '🔥', label: 'Focused', state: 'focused', color: 'var(--accent-cyan)' },
  { emoji: '⚡', label: 'Motivated', state: 'motivated', color: 'var(--success)' },
  { emoji: '😌', label: 'Neutral', state: 'neutral', color: 'var(--text-secondary)' },
  { emoji: '😰', label: 'Stressed', state: 'stressed', color: 'var(--warning)' },
  { emoji: '😤', label: 'Frustrated', state: 'frustrated', color: 'var(--danger)' },
  { emoji: '🥱', label: 'Burnt Out', state: 'burnt_out', color: 'var(--danger)' },
] as const;

interface PulseCheckInProps {
  onComplete: (state: string, config: any) => void;
  onDismiss: () => void;
}

export default function PulseCheckIn({ onComplete, onDismiss }: PulseCheckInProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (state: string) => {
    setSelected(state);
    setSubmitting(true);
    try {
      const res = await fetch('/api/pulse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotionalState: state }),
      });
      const data = await res.json();
      setTimeout(() => onComplete(state, data.config), 600);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)', padding: 'var(--sp-8)',
            maxWidth: 420, width: '90vw', textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 'var(--sp-2)' }}>🧠</div>
          <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-1)' }}>
            How are you feeling right now?
          </h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-6)' }}>
            This helps me adapt your study plan to your current state.
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--sp-3)',
          }}>
            {MOODS.map((mood) => (
              <motion.button
                key={mood.state}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubmit(mood.state)}
                disabled={submitting}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 'var(--sp-1)', padding: 'var(--sp-4)',
                  background: selected === mood.state ? 'var(--bg-active)' : 'var(--bg-tertiary)',
                  border: selected === mood.state
                    ? `2px solid ${mood.color}`
                    : '2px solid transparent',
                  borderRadius: 'var(--radius-lg)',
                  cursor: submitting ? 'wait' : 'pointer',
                  transition: 'all 150ms ease',
                  opacity: submitting && selected !== mood.state ? 0.4 : 1,
                }}
              >
                <span style={{ fontSize: '1.75rem' }}>{mood.emoji}</span>
                <span style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)',
                  color: selected === mood.state ? mood.color : 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)',
                }}>{mood.label}</span>
              </motion.button>
            ))}
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 'var(--sp-6)', padding: 'var(--sp-4)',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-sm)', color: 'var(--accent-cyan)',
              }}
            >
              Adapting your plan...
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
