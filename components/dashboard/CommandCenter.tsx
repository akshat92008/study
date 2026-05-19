'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import Link from 'next/link';
import {
  Brain, Target, RefreshCw, Calendar, BarChart3, Zap,
  Flame, ArrowRight, CheckCircle2, Clock, Send, MessageCircle, Loader2
} from 'lucide-react';

interface Props { profile: any; cognition: any; revision: any; mistakes: any; tasks: any[]; }

export default function CommandCenter({ profile, cognition, revision, mistakes, tasks }: Props) {
  const stats = cognition?.stats || {};
  const revStats = revision?.stats || {};
  const mistakeData = mistakes || {};
  const today = new Date().toISOString().split('T')[0];

  // State for our new Copilot Negotiation
  const [currentTasks, setCurrentTasks] = useState(tasks);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [assistantReply, setAssistantReply] = useState<string | null>(null);

  const completedTasks = currentTasks.filter((t: any) => t.is_completed).length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

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
      
      // Force a page refresh to pull the newly updated database tasks
      setTimeout(() => window.location.reload(), 3000);
      
    } catch (e) {
      setAssistantReply("Connection error. Let's try that again.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Welcome Header */}
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          {greeting}, <span style={{ color: 'var(--accent-blue)' }}>{profile?.full_name || 'Student'}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Flame size={14} style={{ color: profile?.streak_days > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} />
          {profile?.streak_days || 0} day streak
        </p>
      </div>

      {/* ========================================================== */}
      {/* THE NEW COPILOT NEGOTIATION WIDGET */}
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

      {/* KPI Row */}
      <div className="grid-4 stagger">
        <Link href="/cognition" style={{ textDecoration: 'none', color: 'inherit' }}><Card variant="glow"><div className="label">Mastery</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-blue)', margin: 'var(--sp-1) 0' }}>{stats.overallMastery || 0}%</div></Card></Link>
        <Link href="/revision" style={{ textDecoration: 'none', color: 'inherit' }}><Card><div className="label">Cards Due</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: revStats.due > 0 ? 'var(--warning)' : 'var(--success)' }}>{revStats.due || 0}</div></Card></Link>
        <Link href="/mistakes" style={{ textDecoration: 'none', color: 'inherit' }}><Card><div className="label">Marks Lost</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--danger)' }}>-{mistakeData.totalMarksLost || 0}</div></Card></Link>
        <Link href="/planner" style={{ textDecoration: 'none', color: 'inherit' }}><Card><div className="label">Tasks Done</div><div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--success)' }}>{completedTasks}/{currentTasks.length}</div></Card></Link>
      </div>
 
      {/* Quick Task List View */}
      <div className="grid-2">
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)' }}>Today's Tasks</h3>
            <Link href="/planner" style={{ fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>View all <ArrowRight size={12} /></Link>
          </div>
          {currentTasks.slice(0, 5).map((task: any) => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) 0', borderBottom: '1px solid var(--border-subtle)', opacity: task.is_completed ? 0.5 : 1 }}>
              {task.is_completed ? <CheckCircle2 size={14} style={{ color: 'var(--success)' }} /> : <Clock size={14} style={{ color: 'var(--text-tertiary)' }} />}
              <span style={{ fontSize: 'var(--fs-sm)', flex: 1, textDecoration: task.is_completed ? 'line-through' : 'none' }}>{task.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{task.estimated_minutes}m</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
