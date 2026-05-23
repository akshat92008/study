'use client';

import React, { useState, useEffect } from 'react';
import { Play, Flame, Brain, Clock, Target, TrendingUp, BookOpen } from 'lucide-react';

interface SessionCard {
  dayNumber: number;
  streakDays: number;
  focusTopic: string;
  subject: string;
  estimatedMinutes: number;
  rationale: string;
  daysToExam: number | null;
  overdueCards: number;
  masteryPercent: number;
}

interface Props {
  onStartSession: (topic: string, subject: string, estimatedMinutes: number) => void;
}

export default function DailySessionCard({ onStartSession }: Props) {
  const [card, setCard] = useState<SessionCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/session-card')
      .then(r => r.json())
      .then(data => { setCard(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleStart = () => {
    if (!card) return;
    setSessionStarted(true);
    onStartSession(card.focusTopic, card.subject, card.estimatedMinutes);
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)'
      }}>
        <div style={{ height: 16, background: 'var(--bg-tertiary)', borderRadius: 4, width: '60%', marginBottom: 8 }} />
        <div style={{ height: 12, background: 'var(--bg-tertiary)', borderRadius: 4, width: '40%' }} />
      </div>
    );
  }

  if (!card) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(139, 92, 246, 0.05) 100%)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--sp-5)',
      marginBottom: 'var(--sp-4)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle glow accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-tertiary)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase' }}>
            DAY {card.dayNumber}
          </span>
          {card.streakDays > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              <Flame size={11} style={{ color: '#fb923c' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fb923c' }}>{card.streakDays}</span>
            </div>
          )}
          {card.daysToExam && (
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
              {card.daysToExam}d left
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <TrendingUp size={11} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{card.masteryPercent}% mastered</span>
        </div>
      </div>

      {/* Focus card */}
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-1)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: 'var(--ls-wide)' }}>
          TODAY'S FOCUS
        </div>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4 }}>
          {card.focusTopic}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          {card.subject}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{card.estimatedMinutes} min</span>
        </div>
        {card.overdueCards > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Brain size={11} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '11px', color: '#f59e0b' }}>{card.overdueCards} cards overdue</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Target size={11} style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{card.rationale}</span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleStart}
        disabled={sessionStarted}
        style={{
          width: '100%', padding: '10px 0',
          background: sessionStarted
            ? 'var(--bg-tertiary)'
            : 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
          color: sessionStarted ? 'var(--text-tertiary)' : 'white',
          border: 'none', borderRadius: 'var(--radius-md)',
          fontWeight: 'bold', fontSize: 'var(--fs-sm)',
          cursor: sessionStarted ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s'
        }}
        onMouseEnter={e => { if (!sessionStarted) e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      >
        {sessionStarted
          ? <><BookOpen size={14} /> Session Active — Ask me anything</>
          : <><Play size={14} /> START SESSION</>
        }
      </button>
    </div>
  );
}
