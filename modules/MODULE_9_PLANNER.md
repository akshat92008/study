# MODULE 9: Dynamic Academic Planner

## PROMPT FOR AI BUILDER

```
Build the Dynamic Academic Planner for Cognition OS.
AI generates personalized daily study plans based on cognition state, fatigue, exam proximity, and weak areas.
Create: lib/ai/agents/planner.ts, lib/actions/planner.ts, page, and components.
Use Gemini Flash for plan generation. Style with CSS variables. NO Tailwind.
```

---

## STEP 1: Planner Agent — `lib/ai/agents/planner.ts`

```typescript
import { generateJSON } from '@/lib/ai/gemini';
import { createClient } from '@/lib/supabase/server';

export async function generateDailyPlan(userId: string, date: string) {
  const supabase = await createClient();

  const [profileRes, conceptsRes, tasksRes, mistakesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('concepts').select('subject, chapter, mastery, forgetting_probability')
      .eq('user_id', userId).in('mastery', ['not_started', 'exposed', 'developing']),
    supabase.from('study_tasks').select('*').eq('user_id', userId)
      .gte('scheduled_date', date).lte('scheduled_date', date),
    supabase.from('mistakes').select('subject, chapter, category')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);

  const profile = profileRes.data;
  const weakConcepts = (conceptsRes.data || []).slice(0, 15);
  const existingTasks = tasksRes.data || [];
  const recentMistakes = mistakesRes.data || [];

  // Don't regenerate if tasks exist
  if (existingTasks.length > 0) return existingTasks;

  const hoursPerDay = profile?.study_hours_per_day || 8;

  const prompt = `Generate a daily study plan for a NEET student.

Date: ${date}
Study Hours Available: ${hoursPerDay}
Student Emotional State: ${profile?.emotional_state || 'neutral'}
Target Score: ${profile?.target_score || 650}

Weak Concepts (prioritize these):
${weakConcepts.map(c => `- ${c.subject}: ${c.chapter} (${c.mastery})`).join('\n')}

Recent Mistake Areas:
${recentMistakes.map(m => `- ${m.subject}/${m.chapter}: ${m.category}`).join('\n')}

Rules:
- Include 45-minute focus blocks with 10-minute breaks
- Mix subjects to prevent fatigue
- Start with hardest subjects when energy is highest
- Include 1 revision session
- Include 1 practice/mock session
- If student is stressed/burnt_out, reduce load by 30%
- End day with light review

Return JSON array of tasks:
[{
  "title": "task title",
  "description": "brief description of what to do",
  "type": "study|revision|practice|mock_test|break|review",
  "subject": "Physics|Chemistry|Biology",
  "chapter": "chapter name or null",
  "priority": "critical|high|medium|low",
  "estimated_minutes": number,
  "scheduled_start_time": "HH:mm"
}]`;

  const tasks = await generateJSON<any[]>('flash',
    'You are an expert NEET exam planner. Create optimal, realistic study schedules.', prompt);

  if (!tasks || tasks.length === 0) return [];

  // Save to database
  const rows = tasks.map(t => ({
    user_id: userId,
    title: t.title,
    description: t.description || '',
    type: t.type || 'study',
    subject: t.subject || null,
    chapter: t.chapter || null,
    priority: t.priority || 'medium',
    estimated_minutes: t.estimated_minutes || 45,
    scheduled_date: date,
    scheduled_start_time: t.scheduled_start_time || null,
    is_completed: false,
  }));

  const { data } = await supabase.from('study_tasks').insert(rows).select();
  return data || [];
}
```

---

## STEP 2: Server Actions — `lib/actions/planner.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { generateDailyPlan } from '@/lib/ai/agents/planner';

export async function getPlanForDate(date: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return generateDailyPlan(user.id, date);
}

export async function toggleTask(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase.from('study_tasks').select('is_completed').eq('id', taskId).single();
  if (!task) return;

  await supabase.from('study_tasks').update({
    is_completed: !task.is_completed,
    completed_at: !task.is_completed ? new Date().toISOString() : null,
  }).eq('id', taskId);
}
```

---

## STEP 3: Planner Page — `app/(dashboard)/planner/page.tsx`

```tsx
import { getPlanForDate } from '@/lib/actions/planner';
import PlannerDashboard from '@/components/planner/PlannerDashboard';

export default async function PlannerPage() {
  const today = new Date().toISOString().split('T')[0];
  const tasks = await getPlanForDate(today);
  return <PlannerDashboard initialTasks={tasks || []} date={today} />;
}
```

---

## STEP 4: Planner Dashboard — `components/planner/PlannerDashboard.tsx`

```tsx
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
```

---

## VERIFICATION

```bash
npm run dev
# 1. Go to /dashboard/planner
# 2. AI should generate a daily plan (first visit creates tasks)
# 3. Tasks show with icons, subjects, times, priorities
# 4. Clicking a task toggles completion
# 5. Progress bar updates
```

**→ NEXT: MODULE 10 (AI Tutor)**
