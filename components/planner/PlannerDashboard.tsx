'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { toggleTask } from '@/lib/actions/planner';
import DailyBriefing from '@/components/planner/DailyBriefing';
import PulseCheckIn from '@/components/pulse/PulseCheckIn';
import DailySessionFocus from '@/components/dashboard/DailySessionFocus';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, Check, BookOpen, Brain, Target, 
  Coffee, Activity, ArrowRight, Play, CheckCircle2, Flame, Sliders, X, AlertCircle
} from 'lucide-react';

const typeIcons: Record<string, any> = {
  study: BookOpen, 
  revision: Brain, 
  practice: Target, 
  mock_test: Target, 
  break: Coffee, 
  review: Brain,
};

const priorityColor: Record<string, 'red' | 'yellow' | 'blue' | 'gray'> = {
  critical: 'red', 
  high: 'yellow', 
  medium: 'blue', 
  low: 'gray',
};

const typeLabels: Record<string, string> = {
  study: 'Study Block',
  revision: 'FSRS Revision',
  practice: 'Practice Session',
  mock_test: 'Mock Exam',
  break: 'Strategic Rest',
  review: 'End of Day Review',
};

export default function PlannerDashboard({ initialTasks, date }: { initialTasks: any[]; date: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState(initialTasks.length === 0);
  const [showPulse, setShowPulse] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const { addToast } = useAppStore();

  // Replanning state variables
  const [isReplanOpen, setIsReplanOpen] = useState(false);
  const [replanDailyHours, setReplanDailyHours] = useState(8);
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanStep, setReplanStep] = useState<'config' | 'preview'>('config');
  const [replanCandidates, setReplanCandidates] = useState<any[]>([]);
  const [replanPreviewSchedule, setReplanPreviewSchedule] = useState<any[]>([]);

  async function handleReplanPreview() {
    setIsReplanning(true);
    try {
      const res = await fetch('/api/planner/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, commit: false, dailyHours: replanDailyHours }),
      });
      const data = await res.json();
      if (data.success) {
        setReplanCandidates(data.candidates || []);
        setReplanPreviewSchedule(data.schedule || []);
        setReplanStep('preview');
      } else {
        addToast(data.error || 'Failed to generate preview', 'error');
      }
    } catch (e) {
      addToast('Network error during replan', 'error');
    } finally {
      setIsReplanning(false);
    }
  }

  async function handleReplanCommit() {
    setIsReplanning(true);
    try {
      const res = await fetch('/api/planner/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, commit: true, dailyHours: replanDailyHours }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.schedule || []);
        setIsReplanOpen(false);
        setReplanStep('config');
        addToast('Daily schedule reprioritized and saved!', 'success');
      } else {
        addToast(data.error || 'Failed to apply plan', 'error');
      }
    } catch (e) {
      addToast('Network error applying plan', 'error');
    } finally {
      setIsReplanning(false);
    }
  }

  useEffect(() => {
    if (initialTasks.length === 0) {
      setLoading(true);
      fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.plan) {
            setTasks(data.plan);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setTasks(initialTasks);
      setLoading(false);
    }
  }, [initialTasks, date]);

  // Load profile details (for streak tracking)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });
  }, []);

  const completed = tasks.filter(t => t.is_completed).length;
  const totalMinutes = tasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const completedMinutes = tasks.filter(t => t.is_completed).reduce((s, t) => s + (t.estimated_minutes || 0), 0);

  async function handleToggle(taskId: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
    try {
      await toggleTask(taskId);
    } catch (e) {
      addToast("Failed to update task state.", "error");
    }
  }

  // Identify the single active task (first incomplete task, study/revision prioritized)
  const activeSessionTask = tasks.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision'))
    || tasks.find((t: any) => !t.is_completed);

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Socratic Session Overlay */}
      {activeSession && (
        <DailySessionFocus
          taskId={activeSession.id}
          subject={activeSession.subject || 'General'}
          chapter={activeSession.chapter || 'Study Focus'}
          estimatedMinutes={activeSession.estimated_minutes || 25}
          initialStreak={profile?.streak_days || 0}
          onClose={() => setActiveSession(null)}
          onCompleted={(newStreak) => {
            setActiveSession(null);
            setTasks(prev => prev.map(t => t.id === activeSession.id ? { ...t, is_completed: true } : t));
            if (profile) {
              setProfile({ ...profile, streak_days: newStreak });
            }
            addToast("Session completed successfully!", "success");
          }}
        />
      )}

      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Calendar size={28} style={{ color: 'var(--accent-cyan)' }} />
            Today's Plan
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          {profile?.streak_days !== undefined && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
              background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.25)',
              padding: '6px 12px', borderRadius: 'var(--radius-full)'
            }}>
              <Flame size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--warning)' }}>
                {profile.streak_days}D Streak
              </span>
            </div>
          )}
          
          <button
            onClick={() => {
              setReplanDailyHours(profile?.study_hours_per_day || 8);
              setReplanStep('config');
              setIsReplanOpen(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-sm)',
              fontWeight: 'var(--fw-medium)', transition: 'background var(--duration-fast)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          >
            <Target size={16} color="var(--accent-purple)" />
            COMMAND Replan
          </button>
          
          <button
            onClick={() => setShowPulse(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
              padding: '6px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-sm)',
              fontWeight: 'var(--fw-medium)', transition: 'background var(--duration-fast)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          >
            <Activity size={16} color="var(--accent-cyan)" />
            PULSE Check-In
          </button>
        </div>
      </div>

      <DailyBriefing />

      {showPulse && (
        <PulseCheckIn
          onComplete={(state) => {
            setShowPulse(false);
            addToast(`PULSE updated: ${state.replace('_', ' ')}`, 'success');
            if (profile) setProfile({ ...profile, emotional_state: state });
          }}
          onDismiss={() => setShowPulse(false)}
        />
      )}

      {/* Progress Bar */}
      <Card variant="glow" padding="md" style={{ background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            {completed}/{tasks.length} tasks • {Math.round(completedMinutes / 60)}h/{Math.round(totalMinutes / 60)}h completed
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--accent-blue)', fontWeight: 'var(--fw-bold)' }}>
            {tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${tasks.length > 0 ? (completed / tasks.length) * 100 : 0}%`,
            background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
            transition: 'width 0.5s var(--ease-out)',
          }} />
        </div>
      </Card>

      {/* ACTIVE TASK CARD */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
          Current Focus Block
        </h2>
        
        {loading ? (
          <Card style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>
            <div className="animate-pulse" style={{ color: 'var(--text-secondary)' }}>Synthesizing schedule...</div>
          </Card>
        ) : activeSessionTask ? (
          <Card 
            variant="glow" 
            style={{
              background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.7) 0%, rgba(10, 12, 20, 0.9) 100%)',
              border: `1px solid ${activeSessionTask.type === 'revision' ? 'var(--accent-purple-dim)' : 'var(--accent-blue-dim)'}`,
              padding: 'var(--sp-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
              boxShadow: activeSessionTask.type === 'revision' ? 'var(--shadow-glow-purple-dim)' : 'var(--shadow-glow-blue-dim)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <Badge color={activeSessionTask.type === 'revision' ? 'purple' : 'blue'}>
                    {typeLabels[activeSessionTask.type] || 'Study Focus'}
                  </Badge>
                  {activeSessionTask.scheduled_start_time && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} style={{ color: 'var(--accent-cyan)' }} />
                      Scheduled: {activeSessionTask.scheduled_start_time}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', marginTop: 'var(--sp-1)' }}>
                  {activeSessionTask.chapter || activeSessionTask.title}
                </h3>
                {activeSessionTask.subject && (
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} style={{ color: 'var(--accent-cyan)' }} />
                    {activeSessionTask.subject}
                    <span>•</span>
                    <Clock size={14} style={{ color: 'var(--success)' }} />
                    {activeSessionTask.estimated_minutes} Minutes
                  </span>
                )}
              </div>
              
              <Badge color={priorityColor[activeSessionTask.priority] || 'gray'}>
                {activeSessionTask.priority} priority
              </Badge>
            </div>

            {activeSessionTask.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)', borderLeft: '3px solid var(--border-strong)', paddingLeft: 'var(--sp-3)', margin: 'var(--sp-1) 0' }}>
                {activeSessionTask.description}
              </p>
            )}

            {activeSessionTask.notes && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <strong>Strategic Rationale:</strong> {activeSessionTask.notes}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
              {(activeSessionTask.type === 'study' || activeSessionTask.type === 'revision') ? (
                <button
                  onClick={() => setActiveSession(activeSessionTask)}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: activeSessionTask.type === 'revision'
                      ? 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-pink) 100%)'
                      : 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 'var(--fs-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--sp-2)',
                    boxShadow: activeSessionTask.type === 'revision' ? 'var(--shadow-glow-purple)' : 'var(--shadow-glow-blue)',
                    transition: 'transform var(--duration-fast) var(--ease-out)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <Play size={16} fill="white" /> Start Socratic Session <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => handleToggle(activeSessionTask.id)}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 'var(--fs-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--sp-2)',
                    transition: 'background var(--duration-fast)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                >
                  <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> Mark Block Completed
                </button>
              )}
            </div>
          </Card>
        ) : (
          <Card 
            style={{
              background: 'rgba(34, 197, 94, 0.04)',
              border: '1px solid var(--success-dim)',
              padding: 'var(--sp-6)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--sp-3)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 54, height: 54, borderRadius: 'var(--radius-full)',
              background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--success)' }}>
                Habit Locked In!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 4, maxWidth: '400px', margin: '4px auto 0' }}>
                You have completed all scheduled tasks for today. Your cognitive telemetry is logged and your review models are updated.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* TODAY'S QUEUE TIMELINE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
          Today's Queue Timeline
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {tasks.map((task: any) => {
            const Icon = typeIcons[task.type] || BookOpen;
            const isActive = activeSessionTask?.id === task.id;
            
            return (
              <Card 
                key={task.id} 
                padding="sm" 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 'var(--sp-3)',
                  opacity: task.is_completed ? 0.5 : 1,
                  borderLeft: isActive 
                    ? '4px solid var(--accent-blue)' 
                    : task.is_completed 
                      ? '4px solid var(--success)' 
                      : '4px solid var(--border-default)',
                  background: isActive ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'transform var(--duration-fast) var(--ease-out), border-color var(--duration-fast)'
                }} 
                onClick={() => handleToggle(task.id)}
                onMouseEnter={e => { if (!task.is_completed) e.currentTarget.style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
              >
                <button style={{
                  width: 22,
                  height: 22,
                  borderRadius: 'var(--radius-full)',
                  border: `2px solid ${task.is_completed ? 'var(--success)' : 'var(--border-strong)'}`,
                  background: task.is_completed ? 'var(--success)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}>
                  {task.is_completed && <Check size={12} color="white" />}
                </button>

                <Icon size={16} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-tertiary)', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--fs-sm)', 
                    fontWeight: isActive ? 'var(--fw-bold)' : 'var(--fw-medium)',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: task.is_completed ? 'line-through' : 'none',
                  }}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.description}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                  {task.subject && (
                    <Badge color={isActive ? 'blue' : 'gray'}>
                      {task.subject}
                    </Badge>
                  )}
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={10} />
                    {task.estimated_minutes}m
                  </span>
                  {task.scheduled_start_time && (
                    <Badge color="gray">
                      {task.scheduled_start_time}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {tasks.length === 0 && (
          <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
            <Calendar size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto var(--sp-4)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Generating your plan...</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              AI is creating your optimized daily schedule
            </p>
          </Card>
        )}
      </div>

      {/* COMMAND V2 REPLAN DIALOG MODAL */}
      <AnimatePresence>
        {isReplanOpen && (
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
                borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '640px',
                maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: 'var(--shadow-xl)'
              }}
            >
              {/* Modal Header */}
              <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Target size={20} style={{ color: 'var(--accent-purple)' }} />
                  <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)', color: 'var(--text-primary)' }}>
                    COMMAND Engine v2.0
                  </span>
                </div>
                <button 
                  onClick={() => setIsReplanOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {replanStep === 'config' ? (
                  <>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
                      COMMAND evaluates your outstanding syllabus topics, FSRS memory decay schedules, and recent test autopsies to formulate a custom study plan.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                      <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Daily hours allocated: {replanDailyHours} hours
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                        <input 
                          type="range" 
                          min={1} 
                          max={16} 
                          value={replanDailyHours} 
                          onChange={(e) => setReplanDailyHours(Number(e.target.value))}
                          style={{ flex: 1, accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {replanDailyHours * 60}m
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex', gap: 'var(--sp-3)', background: 'var(--bg-secondary)', 
                      padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                      marginTop: 'var(--sp-2)'
                    }}>
                      <Sliders size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 2 }}>
                          Algorithmic Balancing Guardrails
                        </h4>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
                          Prioritized allocations: Backlog (max 30%), FSRS cards (max 25%), autopsies (max 30%), new topics (max 40%). Breaks are auto-inserted.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
                      <button
                        onClick={handleReplanPreview}
                        disabled={isReplanning}
                        style={{
                          flex: 1, padding: '10px 16px', background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-strong)', color: 'var(--text-primary)',
                          borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--fs-sm)'
                        }}
                      >
                        {isReplanning ? 'Analyzing...' : 'Preview Priorities'}
                      </button>
                      <button
                        onClick={handleReplanCommit}
                        disabled={isReplanning}
                        style={{
                          flex: 1, padding: '10px 16px', background: 'var(--accent-purple)',
                          border: 'none', color: 'white', borderRadius: 'var(--radius-md)',
                          cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)',
                          boxShadow: 'var(--shadow-glow-purple-dim)'
                        }}
                      >
                        {isReplanning ? 'Generating...' : 'Commit & Replan'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        Priority Queue Matrix ({replanCandidates.length} Items Evaluated)
                      </h4>
                      <button 
                        onClick={() => setReplanStep('config')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                      >
                        Back to settings
                      </button>
                    </div>

                    {/* Candidate List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', maxHeight: '30vh', overflowY: 'auto', paddingRight: 4 }}>
                      {replanCandidates.map((c, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', background: 'var(--bg-secondary)', 
                          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)'
                        }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.title}</span>
                              <Badge color={c.type === 'revision' ? 'purple' : c.type === 'practice' ? 'red' : 'blue'}>
                                {c.type}
                              </Badge>
                            </div>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>{c.rationale}</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                              Score: {Math.round(c.score)}
                            </span>
                            <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{c.estimatedMinutes}m</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Preview Schedule */}
                    <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: 'var(--sp-2)' }}>
                      Proposed Day Schedule ({replanPreviewSchedule.reduce((s,t) => s+t.estimated_minutes, 0)} mins packed)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', maxHeight: '30vh', overflowY: 'auto', paddingRight: 4 }}>
                      {replanPreviewSchedule.map((t, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', background: t.type === 'break' ? 'rgba(255,255,255,0.02)' : 'var(--bg-tertiary)',
                          borderLeft: t.type === 'break' ? '3px solid var(--border-strong)' : '3px solid var(--accent-blue)', 
                          borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <div>
                            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>{t.title}</span>
                            {t.chapter && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 6 }}>({t.chapter})</span>}
                          </div>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {t.estimated_minutes}m
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
                      <button
                        onClick={() => setReplanStep('config')}
                        style={{
                          flex: 1, padding: '10px 16px', background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-strong)', color: 'var(--text-primary)',
                          borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--fs-sm)'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReplanCommit}
                        disabled={isReplanning}
                        style={{
                          flex: 1, padding: '10px 16px', background: 'var(--accent-purple)',
                          border: 'none', color: 'white', borderRadius: 'var(--radius-md)',
                          cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)',
                          boxShadow: 'var(--shadow-glow-purple-dim)'
                        }}
                      >
                        {isReplanning ? 'Applying Plan...' : 'Apply Schedule'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
