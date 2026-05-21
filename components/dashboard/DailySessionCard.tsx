'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Flame, Clock, Calendar, AlertCircle, Play, CheckCircle } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  estimated_minutes: number;
  is_completed: boolean;
  priority: string;
}

interface BriefingData {
  date: string;
  mood: { state: string; confidence: number };
  daysRemaining: number;
  streak: number;
  examType: string;
  tasks: Task[];
  progress: { completed: number; total: number };
  revision: { dueCount: number; message: string };
  focusAreas: Array<{ subject: string; chapter: string; urgency: string }>;
  greetingText: string;
}

const priorityWeight: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  moderate: 2,
  low: 1,
};

export default function DailySessionCard() {
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [closingMessage, setClosingMessage] = useState<string | null>(null);

  const fetchBriefing = async () => {
    try {
      const res = await fetch('/api/planner/briefing');
      if (res.ok) {
        const briefingData: BriefingData = await res.json();
        setData(briefingData);
        setStreak(briefingData.streak);
      }
    } catch (err) {
      console.error('Failed to fetch morning briefing', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  // Timer Effect
  useEffect(() => {
    let intervalId: any;
    if (sessionActive && sessionStartTime) {
      intervalId = setInterval(() => {
        setElapsed(Date.now() - sessionStartTime);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(intervalId);
  }, [sessionActive, sessionStartTime]);

  const handleStartSession = () => {
    setClosingMessage(null);
    setSessionActive(true);
    setSessionStartTime(Date.now());
  };

  const handleCompleteSession = async (taskId: string, subject: string, chapter: string) => {
    if (completing) return;
    setCompleting(true);

    try {
      // 1. Complete session task
      const resComplete = await fetch('/api/dashboard/complete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const completeData = await resComplete.json();

      let updatedStreak = streak;
      if (completeData.success && completeData.streakDays !== undefined) {
        updatedStreak = completeData.streakDays;
        setStreak(updatedStreak);
      }

      // 2. Fetch personalized close message
      const resClose = await fetch('/api/dashboard/session-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, subject, chapter }),
      });
      const closeData = await resClose.json();

      if (closeData.closing) {
        setClosingMessage(closeData.closing);
      } else if (closeData.success && closeData.message) {
        setClosingMessage(closeData.message);
      }
    } catch (err) {
      console.error('Error completing session', err);
    } finally {
      setCompleting(false);
      setSessionActive(false);
      setSessionStartTime(null);
      // Refetch briefing to update tasks (e.g. mark this task as completed)
      fetchBriefing();
    }
  };

  const formatElapsed = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (num: number) => String(num).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Render skeleton loader
  if (loading) {
    return (
      <div
        style={{
          background: 'var(--glass-bg, var(--bg-glass, hsla(225, 20%, 12%, 0.7)))',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
          animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: '80px', height: '14px', background: 'var(--border-strong)', borderRadius: '4px' }} />
          <div style={{ width: '90px', height: '14px', background: 'var(--border-strong)', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '65%', height: '22px', background: 'var(--border-strong)', borderRadius: '4px', marginTop: 'var(--sp-2)' }} />
        <div style={{ width: '90%', height: '14px', background: 'var(--border-strong)', borderRadius: '4px' }} />
        <div style={{ width: '100%', height: '42px', background: 'var(--border-strong)', borderRadius: '6px', marginTop: 'var(--sp-2)' }} />
      </div>
    );
  }

  if (!data) return null;

  const { tasks = [], daysRemaining, examType, revision = { dueCount: 0 }, greetingText } = data;

  // Pick the FIRST non-completed task with highest priority from tasks[]
  const uncompletedTasks = tasks.filter((t) => !t.is_completed);
  const sortedTasks = [...uncompletedTasks].sort((a, b) => {
    const weightA = priorityWeight[a.priority?.toLowerCase()] || 0;
    const weightB = priorityWeight[b.priority?.toLowerCase()] || 0;
    return weightB - weightA;
  });

  const todaysFocus = sortedTasks[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', width: '100%', marginBottom: 'var(--sp-6)' }}>
      <div
        style={{
          background: 'var(--glass-bg, var(--bg-glass, hsla(225, 20%, 12%, 0.7)))',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-6)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Style helper for custom sub-animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse-dot {
            0% { transform: scale(0.9); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(0.9); opacity: 0.6; }
          }
          .pulse-dot-anim {
            animation: pulse-dot 1.5s infinite ease-in-out;
          }
          :root {
            --accent-amber: hsl(38, 92%, 50%);
          }
        `}} />

        {/* Top row: DAY & STREAK */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            DAY {streak}
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            🔥 STREAK {streak}
          </span>
        </div>

        {todaysFocus ? (
          <>
            {/* Subject + Chapter */}
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>
              {todaysFocus.subject} &gt; {todaysFocus.chapter}
            </h2>

            {/* Subtitle / greeting */}
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-normal)', marginBottom: 'var(--sp-5)' }}>
              ⏱️ {todaysFocus.estimated_minutes} min • {greetingText || 'Ready to start your focus session.'}
            </p>

            {/* Session Controller Panel */}
            {sessionActive ? (
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--sp-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-3)',
                  marginBottom: 'var(--sp-4)',
                  animation: 'fadeIn var(--duration-normal) var(--ease-out)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="pulse-dot-anim"
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--success)',
                        display: 'inline-block',
                        boxShadow: '0 0 8px var(--success)',
                      }}
                    />
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
                      Session active — studying {todaysFocus.subject}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 'var(--fw-bold)' }}>
                    {formatElapsed(elapsed)}
                  </span>
                </div>

                <Button
                  onClick={() => handleCompleteSession(todaysFocus.id, todaysFocus.subject, todaysFocus.chapter)}
                  disabled={completing}
                  style={{
                    background: 'var(--success)',
                    color: '#fff',
                    border: '1px solid var(--success)',
                    width: '100%',
                    fontWeight: 'var(--fw-bold)',
                    padding: 'var(--sp-3) var(--sp-4)',
                  }}
                >
                  <CheckCircle size={16} />
                  {completing ? 'Completing Session...' : 'Complete Session'}
                </Button>
              </div>
            ) : (
              /* START SESSION Button */
              <Button
                onClick={handleStartSession}
                style={{
                  background: 'var(--accent-cyan)',
                  color: 'var(--text-inverse, #05070c)',
                  border: '1px solid var(--accent-cyan)',
                  width: '100%',
                  fontWeight: 'var(--fw-black)',
                  padding: 'var(--sp-3) var(--sp-4)',
                  marginBottom: 'var(--sp-4)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <Play size={16} fill="currentColor" />
                [ START SESSION ]
              </Button>
            )}
          </>
        ) : (
          /* All Completed State */
          <div style={{ textAlign: 'center', padding: 'var(--sp-4) 0', marginBottom: 'var(--sp-2)' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--success)', marginBottom: 'var(--sp-2)' }}>
              🎉 All Daily Focus Tasks Completed!
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
              Excellent job keeping the habit loop active today. Review your concepts or take a quick break!
            </p>
          </div>
        )}

        {/* Footer badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-3)', marginTop: todaysFocus ? 0 : 'var(--sp-2)' }}>
          {revision.dueCount > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--accent-blue)',
                fontSize: 'var(--fs-xs)',
                fontWeight: 'var(--fw-medium)',
              }}
            >
              ⚡ {revision.dueCount} cards overdue
            </span>
          ) : (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              ⚡ Retention stable
            </span>
          )}

          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            📅 {daysRemaining} days to {examType}
          </span>
        </div>
      </div>

      {/* Closing personalized affirmation */}
      {closingMessage && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--sp-4)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-sm)',
            lineHeight: 'var(--lh-relaxed)',
            position: 'relative',
            animation: 'fadeIn var(--duration-normal) var(--ease-out) both',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              left: '16px',
              background: 'var(--bg-primary)',
              padding: '0 8px',
              fontSize: 'var(--fs-xs)',
              color: 'var(--accent-cyan)',
              fontWeight: 'var(--fw-bold)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            MIND Tutor Affirmation
          </div>
          {closingMessage}
        </div>
      )}
    </div>
  );
}
