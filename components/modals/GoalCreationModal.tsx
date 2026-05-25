'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

export default function GoalCreationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { createLearningGoal } = useAppStore();

  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [currentLevel, setCurrentLevel] = useState('beginner');
  const [learningStyle, setLearningStyle] = useState('read_write');
  const [dailyHours, setDailyHours] = useState(8);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !deadline || isSubmitting) return;

    setIsSubmitting(true);
    const created = await createLearningGoal(newGoalTitle.trim(), {
      deadline,
      currentLevel,
      timeAvailable: dailyHours,
      preferredLearningStyle: learningStyle,
    });
    setIsSubmitting(false);

    if (created) {
      setNewGoalTitle('');
      setDeadline('');
      setCurrentLevel('beginner');
      setLearningStyle('read_write');
      setDailyHours(8);
      onClose();
      // Automatically redirect to dashboard if not already there
      if (pathname !== '/dashboard') {
        router.push('/dashboard');
      }
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 'var(--sp-4)'
    }}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '500px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)'
        }}
      >
        {/* Header */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-purple)' }} />
            <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)', color: 'var(--text-primary)' }}>
              Create New Learning Goal
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAddGoal} style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              What do you want to learn?
            </label>
            <input
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="e.g. Machine Learning, NEET Chemistry, CFA Level 1"
              required
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                fontSize: 'var(--fs-sm)', outline: 'none'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            />
          </div>

          {/* Deadline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Target Completion Date
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                fontSize: 'var(--fs-sm)', outline: 'none', width: '100%'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
            />
          </div>

          {/* Level & Style Row */}
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Current Level
              </label>
              <select
                value={currentLevel}
                onChange={(e) => setCurrentLevel(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                  fontSize: 'var(--fs-sm)', outline: 'none', width: '100%', cursor: 'pointer'
                }}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Learning Style
              </label>
              <select
                value={learningStyle}
                onChange={(e) => setLearningStyle(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                  fontSize: 'var(--fs-sm)', outline: 'none', width: '100%', cursor: 'pointer'
                }}
              >
                <option value="read_write">Text & Writing</option>
                <option value="visual">Visual diagrams</option>
                <option value="auditory">Auditory & lectures</option>
                <option value="kinesthetic">Practical projects</option>
              </select>
            </div>
          </div>

          {/* Daily Study Hours */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              <span>Daily Hours Allocated</span>
              <span style={{ color: 'var(--accent-purple)' }}>{dailyHours} hours/day</span>
            </label>
            <input
              type="range"
              min={1}
              max={16}
              value={dailyHours}
              onChange={(e) => setDailyHours(Number(e.target.value))}
              style={{ accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 16px', background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-strong)', color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--fs-sm)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newGoalTitle.trim() || !deadline}
              style={{
                flex: 1, padding: '10px 16px', background: 'var(--accent-purple)',
                border: 'none', color: 'white', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: 'var(--shadow-glow-purple-dim)'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Generating Roadmap...
                </>
              ) : (
                'Generate Roadmap'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
