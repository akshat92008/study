'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface Task {
  id: string;
  title: string;
  completed: boolean;
  subject?: string;
  chapter?: string;
  estimatedMinutes?: number;
}

export default function MicrotargetsCard({ tasks: initialTasks = [] }: { tasks?: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const { addToast } = useAppStore();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const completed = !t.completed;
        if (completed) {
          addToast(`Completed: ${t.title}`, 'success');
        }
        return { ...t, completed };
      }
      return t;
    }));
  };

  const startFocus = (task: Task) => {
    if (task.completed) return;
    const event = new CustomEvent('start-focus-session', {
      detail: {
        title: task.title,
        chapter: task.chapter || task.title,
        subject: task.subject || 'General',
        estimatedMinutes: task.estimatedMinutes || 25,
        taskId: task.id
      }
    });
    window.dispatchEvent(event);
  };

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <ListTodo size={18} style={{ color: 'var(--accent-purple)' }} />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold' }}>Microtargets</h3>
        </div>
        {tasks.length > 0 && (
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            {completedCount}/{tasks.length} done
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--sp-6)', textAlign: 'center', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
          <ListTodo size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-2)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>No specific tasks for today.</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>Ask the AI Tutor to create a study plan or generate tasks from your weak chapters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {tasks.map(task => (
            <div 
              key={task.id}
              onClick={() => toggleTask(task.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--sp-3)',
                background: task.completed ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                border: `1px solid ${task.completed ? 'var(--border-subtle)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                opacity: task.completed ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                {task.completed ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                ) : (
                  <Circle size={18} style={{ color: 'var(--text-tertiary)' }} />
                )}
                <span style={{ 
                  fontSize: 'var(--fs-sm)', 
                  fontWeight: task.completed ? 'normal' : '500',
                  textDecoration: task.completed ? 'line-through' : 'none',
                  color: task.completed ? 'var(--text-tertiary)' : 'var(--text-primary)'
                }}>
                  {task.title}
                </span>
              </div>
              
              {!task.completed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  {task.subject && (
                    <Badge color="purple" style={{ fontSize: '10px', padding: '2px 6px' }}>{task.subject}</Badge>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); startFocus(task); }}
                    style={{
                      background: 'var(--accent-blue-dim)',
                      color: 'var(--accent-blue)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    FOCUS
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
