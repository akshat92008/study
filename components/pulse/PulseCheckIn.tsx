'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Brain, Target, ShieldAlert } from 'lucide-react';

// Reframed to evaluate study friction, not psychological states.
const COGNITIVE_STATES = [
  { icon: Target, label: 'High Momentum', desc: 'Ready for complex topics', state: 'focused', color: 'var(--accent-cyan)' },
  { icon: Activity, label: 'Steady', desc: 'Normal workload is fine', state: 'neutral', color: 'var(--text-secondary)' },
  { icon: Brain, label: 'High Friction', desc: 'Stuck or making repeated mistakes', state: 'frustrated', color: 'var(--warning)' },
  { icon: ShieldAlert, label: 'Cognitive Overload', desc: 'Brain is full. Need lighter tasks.', state: 'overwhelmed', color: 'var(--danger)' },
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
        body: JSON.stringify({ cognitiveState: state }), // Passed safely
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
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)', padding: 'var(--sp-8)',
            maxWidth: 480, width: '90vw',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
            <Activity size={24} color="var(--accent-cyan)" />
            <div>
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>
                System Telemetry Check
              </h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                How is your current cognitive load? We will adjust task intensity.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {COGNITIVE_STATES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selected === mode.state;
              return (
                <motion.button
                  key={mode.state}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSubmit(mode.state)}
                  disabled={submitting}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                    padding: 'var(--sp-4)', background: isSelected ? 'var(--bg-active)' : 'var(--bg-tertiary)',
                    border: isSelected ? `1px solid ${mode.color}` : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)', cursor: submitting ? 'wait' : 'pointer',
                    transition: 'all 150ms ease', textAlign: 'left',
                    opacity: submitting && !isSelected ? 0.4 : 1,
                  }}
                >
                  <Icon size={20} style={{ color: isSelected ? mode.color : 'var(--text-tertiary)' }} />
                  <div>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: isSelected ? mode.color : 'var(--text-primary)' }}>
                      {mode.label}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {mode.desc}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 'var(--sp-6)', padding: 'var(--sp-4)',
                background: 'rgba(0, 240, 255, 0.1)', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-sm)', color: 'var(--accent-cyan)', textAlign: 'center',
                fontWeight: 'var(--fw-medium)'
              }}
            >
              Adapting task intensity and explanation depth...
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
