'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import { CheckCircle, Circle, Clock, Brain, Flame, AlertTriangle, Zap, Calendar, Sparkles, ShieldAlert } from 'lucide-react';

interface BriefingData {
  date: string;
  mood: { state: string; config: { uiMessage: string; uiTone: string } };
  daysRemaining: number;
  streak: number;
  examType: string;
  tasks: any[];
  progress: { completed: number; total: number };
  revision: { dueCount: number; message: string };
  focusAreas: { subject: string; chapter: string; urgency: string }[];
  pulseMessage: string;
  greetingText?: string;
}

const TONE_COLORS: Record<string, string> = {
  push: 'var(--accent-cyan)',
  encourage: 'var(--success)',
  calm: 'var(--warning)',
  rest: 'var(--danger)',
};

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/planner/briefing')
      .then(r => r.json())
      .then(data => { setBriefing(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', color: 'var(--text-tertiary)' }}>
          <Clock size={18} className="animate-spin" style={{ animationDuration: '2s' }} />
          Building your daily mission...
        </div>
      </Card>
    );
  }

  if (!briefing) return null;

  const toneColor = TONE_COLORS[briefing.mood.config.uiTone] || 'var(--text-secondary)';
  const progressPct = briefing.progress.total > 0
    ? Math.round((briefing.progress.completed / briefing.progress.total) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}
    >
      {/* Header Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)' }}>
            Today's Mission
          </h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
            {new Date(briefing.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--warning)' }}>
              {briefing.daysRemaining}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
              days left
            </div>
          </div>
          {briefing.streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', color: 'var(--warning)' }}>
              <Flame size={18} />
              <span style={{ fontWeight: 'var(--fw-bold)' }}>{briefing.streak}</span>
            </div>
          )}
        </div>
      </div>

      {/* Morning Briefing AI Narrative */}
      {briefing.greetingText && (
        <Card id="morning-greeting-card" padding="lg" variant="glow" style={{ background: 'var(--bg-glass)', border: '1px solid var(--accent-blue-dim)', boxShadow: 'var(--shadow-glow-blue)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)' }}>COMMAND AI Briefing</span>
          </div>
          <p style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-medium)', lineHeight: 'var(--lh-relaxed)', color: 'var(--text-primary)', fontStyle: 'italic' }}>
            "{briefing.greetingText}"
          </p>
        </Card>
      )}

      {/* Recovery Mode Active Alert */}
      {briefing.mood.state === 'overwhelmed' && (
        <Card padding="md" style={{ background: 'rgba(0, 240, 255, 0.08)', border: '1px solid var(--accent-cyan)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <ShieldAlert size={20} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 'var(--fw-bold)', color: 'var(--accent-cyan)', fontSize: 'var(--fs-sm)' }}>Recovery Mode Active</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
              We have automatically adjusted your learning path, lightened your workload, and disabled glowing designs to create a serene visual environment.
            </div>
          </div>
        </Card>
      )}

      {/* PULSE Message */}
      <Card padding="md" style={{ borderLeft: `3px solid ${toneColor}`, background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
          <Brain size={20} style={{ color: toneColor, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: toneColor, fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-1)' }}>
              PULSE — {briefing.mood.state.replace('_', ' ')}
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-relaxed)' }}>
              {briefing.pulseMessage}
            </p>
          </div>
        </div>
      </Card>

      {/* Progress Bar */}
      <Card padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>Mission Progress</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            {briefing.progress.completed}/{briefing.progress.total} tasks
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', background: progressPct === 100 ? 'var(--success)' : 'var(--accent-blue)', borderRadius: 'var(--radius-full)' }}
          />
        </div>
      </Card>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {briefing.tasks.map((task: any, i: number) => (
          <motion.div
            key={task.id || i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card padding="sm" style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              opacity: task.is_completed ? 0.5 : 1,
            }}>
              {task.is_completed
                ? <CheckCircle size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                : <Circle size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 'var(--fw-medium)',
                  textDecoration: task.is_completed ? 'line-through' : 'none',
                  color: task.is_completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                }}>
                  {task.title}
                </div>
                {task.subject && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    {task.subject} • {task.estimated_minutes}min
                  </div>
                )}
              </div>
              {task.priority === 'critical' && (
                <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Revision Alert */}
      {briefing.revision.dueCount > 0 && (
        <Card padding="md" style={{ borderLeft: '3px solid var(--accent-purple)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Zap size={20} style={{ color: 'var(--accent-purple)' }} />
            <div>
              <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)' }}>
                {briefing.revision.dueCount} cards due for revision
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                {briefing.revision.message}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Focus Areas */}
      {briefing.focusAreas.length > 0 && (
        <Card padding="md">
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-3)' }}>
            Focus Areas Today
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            {briefing.focusAreas.map((area: any, i: number) => (
              <span key={i} style={{
                padding: 'var(--sp-1) var(--sp-3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)',
                background: area.urgency === 'critical' ? 'var(--danger-dim)' : 'var(--bg-tertiary)',
                color: area.urgency === 'critical' ? 'var(--danger)' : 'var(--text-secondary)',
                border: `1px solid ${area.urgency === 'critical' ? 'var(--danger)' : 'var(--border-subtle)'}`,
              }}>
                {area.subject}: {area.chapter}
              </span>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
