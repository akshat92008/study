'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { toggleTask } from '@/lib/actions/planner';
import { Calendar, Clock, Check, Circle, BookOpen, Brain, Target, Coffee } from 'lucide-react';

const typeIcons: Record<string, any> = {
  study: BookOpen, revision: Brain, practice: Target, mock_test: Target, break: Coffee, review: Brain,
};
const priorityColor: Record<string, 'red' | 'yellow' | 'blue' | 'gray'> = {
  critical: 'red', high: 'yellow', medium: 'blue', low: 'gray',
};

export default function PlannerDashboard({ initialTasks, date }: { initialTasks: any[]; date: string }) {
  const [tasks, setTasks] = useState(initialTasks);

  const completed = tasks.filter(t => t.is_completed).length;
  const totalMinutes = tasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
  const completedMinutes = tasks.filter(t => t.is_completed).reduce((s, t) => s + (t.estimated_minutes || 0), 0);

  async function handleToggle(taskId: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t));
    await toggleTask(taskId);
  }

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <Calendar size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-cyan)' }} />
          Today's Plan
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
          {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Progress Bar */}
      <Card variant="glow" padding="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            {completed}/{tasks.length} tasks • {Math.round(completedMinutes / 60)}h/{Math.round(totalMinutes / 60)}h
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--accent-blue)' }}>
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

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {tasks.map((task: any) => {
          const Icon = typeIcons[task.type] || BookOpen;
          return (
            <Card key={task.id} padding="sm" style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              opacity: task.is_completed ? 0.5 : 1,
              cursor: 'pointer',
            }} onClick={() => handleToggle(task.id)}>
              <button style={{
                width: 22, height: 22, borderRadius: 'var(--radius-full)',
                border: `2px solid ${task.is_completed ? 'var(--success)' : 'var(--border-strong)'}`,
                background: task.is_completed ? 'var(--success)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}>
                {task.is_completed && <Check size={12} color="white" />}
              </button>

              <Icon size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)',
                  textDecoration: task.is_completed ? 'line-through' : 'none',
                }}>{task.title}</div>
                {task.description && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.description}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                {task.subject && <Badge color={priorityColor[task.priority] || 'gray'}>{task.subject}</Badge>}
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                  {task.estimated_minutes}m
                </span>
                {task.scheduled_start_time && (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {task.scheduled_start_time}
                  </span>
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
  );
}
