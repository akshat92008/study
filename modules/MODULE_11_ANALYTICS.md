# MODULE 11: Performance Analytics Dashboard

## PROMPT FOR AI BUILDER

```
Build the Performance Analytics Engine for Cognition OS.
This is the "Bloomberg Terminal" view — data-dense, real-time performance intelligence.
Uses Recharts for charts. Create: lib/engines/performance-engine.ts, actions, page, and chart components.
Style with CSS variables. NO Tailwind. Use lucide-react icons.
```

---

## STEP 1: Performance Engine — `lib/engines/performance-engine.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export async function getPerformanceData(userId: string) {
  const supabase = await createClient();

  const [mockTestsRes, snapshotsRes, conceptsRes, mistakesRes, tasksRes] = await Promise.all([
    supabase.from('mock_tests').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('performance_snapshots').select('*').eq('user_id', userId).order('date', { ascending: true }).limit(30),
    supabase.from('concepts').select('subject, mastery').eq('user_id', userId),
    supabase.from('mistakes').select('subject, category, marks_lost').eq('user_id', userId),
    supabase.from('study_tasks').select('is_completed, estimated_minutes, scheduled_date').eq('user_id', userId),
  ]);

  const mockTests = mockTestsRes.data || [];
  const concepts = conceptsRes.data || [];
  const mistakes = mistakesRes.data || [];
  const tasks = tasksRes.data || [];

  // Score trend (from mock tests)
  const scoreTrend = mockTests.map((t: any) => ({
    name: t.test_name,
    score: t.marks_obtained,
    total: t.total_marks,
    accuracy: t.correct && t.attempted ? Math.round((t.correct / t.attempted) * 100) : 0,
    date: t.created_at,
  }));

  // Subject mastery radar data
  const subjects = ['Physics', 'Chemistry', 'Biology'];
  const masteryValues: Record<string, number> = {
    not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
  };
  const subjectMastery = subjects.map(sub => {
    const subConcepts = concepts.filter(c => c.subject === sub);
    const avg = subConcepts.length > 0
      ? Math.round(subConcepts.reduce((s, c) => s + (masteryValues[c.mastery] || 0), 0) / subConcepts.length)
      : 0;
    return { subject: sub, mastery: avg };
  });

  // Mistake distribution
  const mistakeDistribution: Record<string, number> = {};
  mistakes.forEach((m: any) => {
    mistakeDistribution[m.category] = (mistakeDistribution[m.category] || 0) + 1;
  });

  // Task completion rate
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // Predicted score (simple linear regression on mock scores)
  let predictedScore = null;
  if (scoreTrend.length >= 2) {
    const lastTwo = scoreTrend.slice(-2);
    const trend = lastTwo[1].score - lastTwo[0].score;
    predictedScore = Math.min(720, Math.max(0, lastTwo[1].score + trend));
  }

  // Overall stats
  const totalStudyMinutes = tasks.filter(t => t.is_completed).reduce((s, t) => s + (t.estimated_minutes || 0), 0);

  return {
    scoreTrend,
    subjectMastery,
    mistakeDistribution,
    taskCompletionRate,
    predictedScore,
    totalStudyHours: Math.round(totalStudyMinutes / 60),
    totalMockTests: mockTests.length,
    totalMistakes: mistakes.length,
    totalMarksLost: mistakes.reduce((s, m) => s + (m.marks_lost || 0), 0),
    latestScore: scoreTrend.length > 0 ? scoreTrend[scoreTrend.length - 1].score : null,
  };
}
```

---

## STEP 2: Server Action — `lib/actions/analytics.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { getPerformanceData } from '@/lib/engines/performance-engine';

export async function getAnalyticsData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getPerformanceData(user.id);
}
```

---

## STEP 3: Analytics Page — `app/(dashboard)/analytics/page.tsx`

```tsx
import { getAnalyticsData } from '@/lib/actions/analytics';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  return <AnalyticsDashboard data={data} />;
}
```

---

## STEP 4: Analytics Dashboard — `components/analytics/AnalyticsDashboard.tsx`

```tsx
'use client';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { BarChart3, TrendingUp, Target, Clock, Brain, Flame } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

const CHART_COLORS = ['hsl(220,90%,56%)', 'hsl(265,80%,60%)', 'hsl(185,80%,50%)', 'hsl(142,71%,45%)', 'hsl(38,92%,50%)', 'hsl(0,84%,60%)'];

export default function AnalyticsDashboard({ data }: { data: any }) {
  if (!data) return <p style={{ color: 'var(--text-tertiary)' }}>No data yet.</p>;

  const { scoreTrend, subjectMastery, mistakeDistribution, taskCompletionRate,
    predictedScore, totalStudyHours, totalMockTests, totalMistakes, totalMarksLost, latestScore } = data;

  const mistakeData = Object.entries(mistakeDistribution).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <BarChart3 size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-blue)' }} />
          Performance Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
          Your academic intelligence dashboard
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 stagger">
        <Card variant="glow">
          <div className="label">Latest Score</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
            {latestScore ?? '—'}<span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>/720</span>
          </div>
        </Card>
        <Card>
          <div className="label">Predicted Score</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>
            {predictedScore ?? '—'}
          </div>
          {predictedScore && <Badge color="purple">AI Predicted</Badge>}
        </Card>
        <Card>
          <div className="label">Study Hours</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            {totalStudyHours}h
          </div>
        </Card>
        <Card>
          <div className="label">Task Completion</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
            {taskCompletionRate}%
          </div>
          <Progress value={taskCompletionRate} color="green" size="sm" />
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        {/* Score Trend */}
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <TrendingUp size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)' }} />
            Score Trend
          </h3>
          {scoreTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} domain={[0, 720]} />
                <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="hsl(220,90%,56%)" strokeWidth={2} dot={{ fill: 'hsl(220,90%,56%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--sp-8)' }}>Take mock tests to see trends</p>}
        </Card>

        {/* Subject Mastery Radar */}
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <Brain size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)' }} />
            Subject Mastery
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={subjectMastery}>
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <Radar name="Mastery" dataKey="mastery" stroke="hsl(265,80%,60%)" fill="hsla(265,80%,60%,0.3)" />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Mistake Distribution */}
      {mistakeData.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <Target size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)' }} />
            Mistake Distribution ({totalMistakes} total, -{totalMarksLost} marks)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mistakeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {mistakeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
# Visit /dashboard/analytics
# Should see KPI cards, charts (empty states if no data yet)
# After logging mistakes and taking mock tests, charts will populate
```

**→ NEXT: MODULE 12 (Input/Ingest Layer)**
