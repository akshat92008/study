'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import Link from 'next/link';
import {
  Brain, Target, RefreshCw, Calendar, BarChart3, Zap,
  Flame, ArrowRight, CheckCircle2, Clock, Send, MessageCircle, Loader2, BookOpen, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import DailySessionFocus from './DailySessionFocus';

interface Props { 
  profile: any; 
  cognition: any; 
  revision: any; 
  mistakes: any; 
  tasks: any[]; 
  onRefresh?: () => void;
}

export default function CommandCenter({ profile, cognition, revision, mistakes, tasks, onRefresh }: Props) {
  const stats = cognition?.stats || {};
  const revStats = revision?.stats || {};
  const mistakeData = mistakes || {};
  const today = new Date().toISOString().split('T')[0];

  // State for our new Copilot Negotiation
  const [currentTasks, setCurrentTasks] = useState(tasks);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [assistantReply, setAssistantReply] = useState<string | null>(null);

  // State to track if student is actively in a Socratic session
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    setCurrentTasks(tasks);
  }, [tasks]);

  const completedTasks = currentTasks.filter((t: any) => t.is_completed).length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Find the first uncompleted study or revision task for today
  const activeSessionTask = currentTasks.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision')) 
    || currentTasks.find((t: any) => !t.is_completed); // fallback to first uncompleted task

  // Handle negotiating the plan
  const handleNegotiate = async () => {
    if (!chatInput.trim() || chatLoading) return;
    setChatLoading(true);
    setAssistantReply(null);
    
    try {
      const res = await fetch('/api/ai/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput, date: today }),
      });
      const data = await res.json();
      
      setAssistantReply(data.reply);
      setChatInput('');
      
      // Update tasks dynamically without a full browser reload
      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
          setAssistantReply(null);
        } else {
          window.location.reload();
        }
      }, 3000);
      
    } catch (e) {
      setAssistantReply("Connection error. Let's try that again.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Active Socratic Focus Workspace */}
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
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Welcome Header with Duolingo Flame */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
            {greeting}, <span style={{ color: 'var(--accent-blue)' }}>{profile?.full_name || 'Student'}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            Your academic missions are synchronized.
          </p>
        </div>
        
        {/* Dynamic Streak Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          padding: 'var(--sp-2) var(--sp-4)',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 0 15px rgba(249, 115, 22, 0.1)'
        }}>
          <Flame size={18} style={{ color: 'var(--warning)', filter: 'drop-shadow(0 0 4px var(--warning))' }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-black)', color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
            {profile?.streak_days || 0} DAY STREAK
          </span>
        </div>
      </div>

      {/* Today's Focus Session Card */}
      {activeSessionTask ? (
        <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
          <Card variant="glow" style={{
            background: 'linear-gradient(135deg, rgba(20, 24, 33, 0.6) 0%, rgba(10, 12, 18, 0.8) 100%)',
            border: '1px solid var(--accent-blue-dim)',
            padding: 'var(--sp-6)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-glow-blue-dim)'
          }}>
          {/* background glowing effect */}
          <div style={{
            position: 'absolute', top: '-50%', right: '-20%', width: 250, height: 250,
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1, gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Badge color="cyan">
                  Today's Focus Session
                </Badge>
                <span style={{
                  width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--accent-blue)',
                  animation: 'ping 1.5s infinite'
                }} />
              </div>
              
              <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', marginTop: 'var(--sp-1)' }}>
                {activeSessionTask.chapter || activeSessionTask.title}
              </h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={12} style={{ color: 'var(--accent-cyan)' }} />
                  {activeSessionTask.subject || 'General'}
                </span>
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} style={{ color: 'var(--success)' }} />
                  {activeSessionTask.estimated_minutes || 25} Minutes
                </span>
              </div>
              
              <p style={{
                fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                marginTop: 'var(--sp-3)', lineHeight: 'var(--lh-relaxed)',
                background: 'rgba(255, 255, 255, 0.03)', padding: 'var(--sp-3)',
                borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--accent-blue)'
              }}>
                {activeSessionTask.notes || activeSessionTask.description || 'Command center prioritized session.'}
              </p>
            </div>
            
            <button
              onClick={() => setActiveSession(activeSessionTask)}
              style={{
                padding: 'var(--sp-3) var(--sp-6)',
                background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--fs-sm)',
                boxShadow: 'var(--shadow-glow-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                transition: 'transform var(--duration-fast) var(--ease-out)',
                alignSelf: 'center',
                flexShrink: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Start Session <ArrowRight size={16} />
            </button>
          </div>
        </Card>
        </motion.div>
      ) : (
        <Card style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(20, 24, 33, 0.6) 100%)',
          border: '1px solid var(--success-dim)',
          padding: 'var(--sp-6)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--sp-3)'
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 54, height: 54, borderRadius: 'var(--radius-full)',
            background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)'
          }}>
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Daily Habit Locked In!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 4 }}>
              You've completed all scheduled study focus blocks for today. Keep the streak active tomorrow!
            </p>
          </div>
        </Card>
      )}

      {/* ========================================================== */}
      {/* THE MISSION COPILOT NEGOTIATION WIDGET */}
      {/* ========================================================== */}
      <Card variant="glow" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-purple-dim)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
          <MessageCircle size={18} style={{ color: 'var(--accent-purple)' }} />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>Mission Copilot</h3>
        </div>
        
        {assistantReply ? (
          <div style={{ padding: 'var(--sp-4)', background: 'var(--accent-purple-dim)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)' }}>{assistantReply}</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>Refreshing your dashboard in 3 seconds...</p>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
            This is your plan for today. Too much? Too little? Tell me what to change.
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <input 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNegotiate(); }}
            placeholder="e.g., 'I'm tired, remove Physics and just give me 30 mins of Bio...'"
            disabled={chatLoading}
            style={{
              flex: 1, padding: 'var(--sp-3)', background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', outline: 'none', fontSize: 'var(--fs-sm)'
            }}
          />
          <button 
            onClick={handleNegotiate}
            disabled={chatLoading || !chatInput.trim()}
            style={{
              padding: '0 var(--sp-4)', background: 'var(--accent-purple)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </Card>
      {/* Silent OS Modules (Depth) */}
      <h3 style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginTop: 'var(--sp-4)' }}>
        System Diagnostics (OS Depth)
      </h3>
      <div className="grid-4 stagger">
        <Link href="/cognition" style={{ textDecoration: 'none', color: 'inherit' }}><Card variant="default" className="card-interactive"><div className="label">ATLAS Mastery</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-blue)', margin: 'var(--sp-1) 0' }}>{stats.overallMastery || 0}%</div><Progress value={stats.overallMastery || 0} color="blue" size="sm" /></Card></Link>
        <Link href="/revision" style={{ textDecoration: 'none', color: 'inherit' }}><Card className="card-interactive"><div className="label">MEMORY Due</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: revStats.due > 0 ? 'var(--warning)' : 'var(--success)' }}>{revStats.due || 0}</div></Card></Link>
        <Link href="/mistakes" style={{ textDecoration: 'none', color: 'inherit' }}><Card className="card-interactive"><div className="label">AUTOPSY Loss</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--danger)' }}>-{mistakeData.totalMarksLost || 0}</div></Card></Link>
        <Link href="/pulse" style={{ textDecoration: 'none', color: 'inherit' }}><Card className="card-interactive"><div className="label">PULSE State</div><div style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-black)', color: profile?.emotional_state === 'burnt_out' ? 'var(--danger)' : 'var(--text-primary)', marginTop: 'var(--sp-2)', textTransform: 'capitalize' }}>{profile?.emotional_state || 'Neutral'} <Activity size={16} style={{display:'inline', marginLeft:4}}/></div></Card></Link>
      </div>
    </div>
  );
}
