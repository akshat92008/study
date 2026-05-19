'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import Link from 'next/link';
import {
  Brain, Target, RefreshCw, Calendar, BarChart3, Zap,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Flame, ArrowRight,
} from 'lucide-react';

interface Props {
  profile: any;
  cognition: any;
  revision: any;
  mistakes: any;
  tasks: any[];
}

export default function CommandCenter({ profile, cognition, revision, mistakes, tasks }: Props) {
  const stats = cognition?.stats || {};
  const revStats = revision?.stats || {};
  const mistakeData = mistakes || {};
  const completedTasks = tasks.filter((t: any) => t.is_completed).length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const daysRemaining = (() => {
    if (!profile?.exam_date) {
      const targetYear = profile?.target_year || new Date().getFullYear() + 1;
      const defaultExamDate = new Date(`${targetYear}-05-01T00:00:00Z`);
      return Math.max(0, Math.ceil((defaultExamDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    return Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  })();

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
          <span style={{ color: 'var(--border-default)' }}>•</span>
          {profile?.exam_type || 'NEET'} {profile?.target_year || 2026}
          <span style={{ color: 'var(--border-default)' }}>•</span>
          <span style={{ color: 'var(--warning)', fontWeight: 'var(--fw-semibold)' }}>{daysRemaining} days left</span>
        </p>
      </div>

      {/* Exam Countdown Banner */}
      {daysRemaining > 0 && (
        <Card variant="glow" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <Calendar size={20} style={{ color: 'var(--warning)' }} />
              <div>
                <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-sm)' }}>Exam Countdown</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Target date: {profile?.exam_date ? new Date(profile.exam_date).toLocaleDateString() : 'May 1, ' + (profile?.target_year || (new Date().getFullYear() + 1))}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-1)' }}>
              <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', color: 'var(--warning)' }}>{daysRemaining}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>days left</span>
            </div>
          </div>
        </Card>
      )}

      {/* Primary KPIs */}
      <div className="grid-4 stagger">
        <Link href="/cognition" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card variant="glow" style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="label">Mastery</div>
              <Brain size={16} style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', margin: 'var(--sp-1) 0' }}>
              {stats.overallMastery || 0}%
            </div>
            <Progress value={stats.overallMastery || 0} color="blue" size="sm" />
          </Card>
        </Link>

        <Link href="/revision" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="label">Cards Due</div>
              <RefreshCw size={16} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: revStats.due > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {revStats.due || 0}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{revStats.total || 0} total cards</div>
          </Card>
        </Link>

        <Link href="/mistakes" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="label">Marks Lost</div>
              <Target size={16} style={{ color: 'var(--danger)' }} />
            </div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
              -{mistakeData.totalMarksLost || 0}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{mistakeData.mistakes?.length || 0} mistakes</div>
          </Card>
        </Link>

        <Link href="/planner" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Card style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="label">Today</div>
              <Calendar size={16} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
              {completedTasks}/{tasks.length}
            </div>
            <Progress value={tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0} color="green" size="sm" />
          </Card>
        </Link>
      </div>

      {/* Today's Tasks Quick View */}
      <div className="grid-2">
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)' }}>Today's Tasks</h3>
            <Link href="/planner" style={{ fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {tasks.slice(0, 5).map((task: any) => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
              padding: 'var(--sp-2) 0', borderBottom: '1px solid var(--border-subtle)',
              opacity: task.is_completed ? 0.5 : 1,
            }}>
              {task.is_completed
                ? <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                : <Clock size={14} style={{ color: 'var(--text-tertiary)' }} />}
              <span style={{ fontSize: 'var(--fs-sm)', flex: 1, textDecoration: task.is_completed ? 'line-through' : 'none' }}>
                {task.title}
              </span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {task.estimated_minutes}m
              </span>
            </div>
          ))}
          {tasks.length === 0 && (
            <div style={{
              textAlign: 'center', padding: 'var(--sp-6)', 
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-default)'
            }}>
              <Calendar size={32} style={{ color: 'var(--text-tertiary)', margin: '0 auto var(--sp-2)' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>No tasks scheduled for today</p>
              <Link href="/planner" style={{
                display: 'inline-block', padding: 'var(--sp-2) var(--sp-4)',
                background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', textDecoration: 'none'
              }}>Generate Plan</Link>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {[
              { href: '/revision', icon: RefreshCw, label: 'Start Revision Session', color: 'var(--accent-cyan)', count: revStats.due },
              { href: '/mistakes', icon: Target, label: 'Log a Mistake', color: 'var(--danger)' },
              { href: '/analytics/log-test', icon: BarChart3, label: 'Log Mock Test', color: 'var(--accent-blue)' },
              { href: '/mentor', icon: Zap, label: 'Talk to AI Mentor', color: 'var(--accent-purple)' },
            ].map(action => (
              <Link key={action.href} href={action.href} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)', textDecoration: 'none', color: 'inherit',
                transition: 'background var(--duration-fast)',
              }}>
                <action.icon size={16} style={{ color: action.color }} />
                <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>{action.label}</span>
                {action.count !== undefined && action.count > 0 && (
                  <Badge color="yellow">{action.count}</Badge>
                )}
                <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
