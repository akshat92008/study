'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Flame, Brain, Clock, Target, TrendingUp, BookOpen, CheckCircle2, Square } from 'lucide-react';

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
  onEndSession?: () => void;
  isCollapsed?: boolean;
}

function useTopicTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (running && !intervalRef.current) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
      }, 1000);
    }
    if (!running && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const reset = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setElapsed(0);
    startRef.current = null;
  };

  const formatted = () => {
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return { elapsed, formatted, reset };
}

export default function DailySessionCard({ onStartSession, onEndSession, isCollapsed = false }: Props) {
  const [card, setCard] = useState<SessionCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const { elapsed, formatted, reset } = useTopicTimer(sessionStarted && !sessionDone);

  useEffect(() => {
    fetch('/api/dashboard/session-card')
      .then(r => r.json())
      .then(data => { setCard(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleStart = () => {
    if (!card) return;
    reset();
    setSessionDone(false);
    setSessionStarted(true);
    onStartSession(card.focusTopic, card.subject, card.estimatedMinutes);
  };

  const handleEnd = () => {
    setSessionStarted(false);
    setSessionDone(true);
    onEndSession?.();
  };

  // Progress ring: elapsed vs target minutes
  const targetSeconds = (card?.estimatedMinutes ?? 45) * 60;
  const progress = Math.min(1, elapsed / targetSeconds);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = circumference * (1 - progress);
  const overTime = elapsed > targetSeconds;

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

  // ── Collapsed view ──────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(139, 92, 246, 0.05) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        marginBottom: 'var(--sp-4)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '12px',
        flexWrap: 'wrap', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 60, height: 60,
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, marginRight: '8px' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: sessionStarted ? 'var(--success)' : 'var(--accent-purple)',
            boxShadow: sessionStarted ? '0 0 6px var(--success)' : 'none',
            flexShrink: 0
          }} />
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Day {card.dayNumber}:
          </span>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.focusTopic}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Timer pill — only when session is running */}
          {sessionStarted && !sessionDone && (
            <span style={{
              fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold',
              color: overTime ? '#f87171' : 'var(--accent-cyan)',
              background: overTime ? 'rgba(248,113,113,0.1)' : 'rgba(20,184,166,0.1)',
              border: `1px solid ${overTime ? 'rgba(248,113,113,0.3)' : 'rgba(20,184,166,0.3)'}`,
              borderRadius: 'var(--radius-sm)', padding: '2px 8px'
            }}>
              {formatted()}
            </span>
          )}
          {sessionDone && (
            <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> Done
            </span>
          )}
          {!sessionStarted && !sessionDone && (
            <button onClick={handleStart} style={{
              padding: '4px 12px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
              color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
              fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'
            }}>Start</button>
          )}
          {sessionStarted && (
            <button onClick={handleEnd} style={{
              padding: '4px 10px',
              background: 'rgba(248,113,113,0.12)',
              color: '#f87171', border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 'var(--radius-sm)', fontWeight: 'bold',
              fontSize: '11px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              <Square size={10} fill="#f87171" /> End
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Full card view ──────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(139, 92, 246, 0.05) 100%)',
      border: `1px solid ${sessionStarted ? 'rgba(20,184,166,0.4)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--sp-5)',
      marginBottom: 'var(--sp-4)',
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.3s'
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
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

      {/* Topic */}
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

      {/* Meta + live timer row */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Progress ring + timer — shown only when session is running */}
        {sessionStarted && !sessionDone ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* SVG ring */}
            <svg width={44} height={44} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={22} cy={22} r={radius}
                fill="none" stroke="var(--bg-tertiary)" strokeWidth={3} />
              <circle cx={22} cy={22} r={radius}
                fill="none"
                stroke={overTime ? '#f87171' : 'var(--accent-cyan)'}
                strokeWidth={3}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDash}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
              />
            </svg>
            <div>
              <div style={{
                fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold',
                color: overTime ? '#f87171' : 'var(--accent-cyan)',
                lineHeight: 1
              }}>
                {formatted()}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                / {card.estimatedMinutes}:00
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{card.estimatedMinutes} min</span>
          </div>
        )}

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
      {!sessionStarted && !sessionDone && (
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '10px 0',
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
            color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 'bold', fontSize: 'var(--fs-sm)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Play size={14} /> START SESSION
        </button>
      )}

      {sessionStarted && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, padding: '10px 0',
            background: 'rgba(20,184,166,0.08)',
            border: '1px solid rgba(20,184,166,0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 'var(--fs-sm)', color: 'var(--accent-cyan)', fontWeight: 'bold'
          }}>
            <BookOpen size={14} /> Session Active
          </div>
          <button
            onClick={handleEnd}
            style={{
              padding: '10px 20px',
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f87171', fontWeight: 'bold',
              fontSize: 'var(--fs-sm)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Square size={13} fill="#f87171" /> End Session
          </button>
        </div>
      )}

      {sessionDone && (
        <div style={{
          width: '100%', padding: '10px 0',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 'bold'
        }}>
          <CheckCircle2 size={14} /> Session Complete
        </div>
      )}
    </div>
  );
}
