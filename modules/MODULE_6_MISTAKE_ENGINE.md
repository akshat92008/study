# MODULE 6: Mistake Intelligence Engine

## PROMPT FOR AI BUILDER

```
You are building the Mistake Intelligence Engine — the FLAGSHIP feature of Cognition OS.
It analyzes WHY marks are lost, detects recurring mistake patterns, and generates actionable insights.
Build the engine (lib/engines/mistake-engine.ts), server actions, API route, and UI page.
Use Gemini AI for deep mistake analysis. Style with CSS variables. NO Tailwind.
```

---

## STEP 1: Mistake Engine — `lib/engines/mistake-engine.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';

export async function getMistakeAnalytics(userId: string) {
  const supabase = await createClient();

  const { data: mistakes } = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!mistakes || mistakes.length === 0) return { mistakes: [], patterns: [], totalMarksLost: 0, insights: null };

  // Aggregate patterns by category
  const categoryMap: Record<string, { count: number; marksLost: number; subjects: Set<string> }> = {};
  let totalMarksLost = 0;

  mistakes.forEach((m: any) => {
    if (!categoryMap[m.category]) categoryMap[m.category] = { count: 0, marksLost: 0, subjects: new Set() };
    categoryMap[m.category].count++;
    categoryMap[m.category].marksLost += m.marks_lost || 0;
    categoryMap[m.category].subjects.add(m.subject);
    totalMarksLost += m.marks_lost || 0;
  });

  const patterns = Object.entries(categoryMap).map(([category, data]) => ({
    category,
    count: data.count,
    marksLost: data.marksLost,
    subjects: Array.from(data.subjects),
    percentage: Math.round((data.count / mistakes.length) * 100),
  })).sort((a, b) => b.marksLost - a.marksLost);

  // Subject-wise breakdown
  const subjectMap: Record<string, number> = {};
  mistakes.forEach((m: any) => {
    subjectMap[m.subject] = (subjectMap[m.subject] || 0) + (m.marks_lost || 0);
  });

  return { mistakes, patterns, totalMarksLost, subjectBreakdown: subjectMap };
}

// AI-powered deep analysis of a specific mistake
export async function analyzeMistake(mistakeData: {
  subject: string; chapter: string; questionText?: string;
  userAnswer?: string; correctAnswer?: string; category: string;
}) {
  const prompt = `Analyze this NEET exam mistake deeply:

Subject: ${mistakeData.subject}
Chapter: ${mistakeData.chapter}
Category: ${mistakeData.category}
Question: ${mistakeData.questionText || 'Not provided'}
Student Answer: ${mistakeData.userAnswer || 'Not provided'}
Correct Answer: ${mistakeData.correctAnswer || 'Not provided'}

Provide JSON response:
{
  "rootCause": "Why did the student make this mistake (1-2 sentences)",
  "conceptualGap": "What concept is weak or missing",
  "emotionalFactor": "Any emotional/behavioral factor (anxiety, overconfidence, etc.)",
  "fixStrategy": "Specific actionable strategy to prevent this mistake",
  "practiceRecommendation": "What to practice specifically",
  "severityScore": 1-10 (how critical is this mistake pattern)
}`;

  return generateJSON('flash', 'You are an expert NEET exam analyst and cognitive psychologist.', prompt);
}

// Generate a full mark-loss report using AI
export async function generateMarkLossReport(userId: string) {
  const { mistakes, patterns, totalMarksLost } = await getMistakeAnalytics(userId);
  if (mistakes.length === 0) return null;

  const recentMistakes = mistakes.slice(0, 20).map((m: any) =>
    `${m.subject}/${m.chapter}: ${m.category} (-${m.marks_lost} marks)`
  ).join('\n');

  const prompt = `Generate a comprehensive mark-loss report for this NEET student:

Total Marks Lost: ${totalMarksLost}
Total Mistakes Logged: ${mistakes.length}

Mistake Patterns:
${patterns.map((p: any) => `- ${p.category}: ${p.count} times, ${p.marksLost} marks lost (${p.percentage}%)`).join('\n')}

Recent Mistakes:
${recentMistakes}

Respond as JSON:
{
  "headline": "One-line brutally honest assessment",
  "markRecoveryPotential": number (how many marks could be recovered with targeted intervention),
  "topIssues": [
    { "issue": "description", "marksImpact": number, "fixDifficulty": "easy|medium|hard", "fixTimeWeeks": number }
  ],
  "weeklyPlan": "Specific 1-week improvement plan",
  "emotionalInsight": "What emotional/behavioral pattern is most damaging"
}`;

  return generateJSON('pro', 'You are an elite NEET exam strategist who gives brutally honest, data-driven advice.', prompt);
}
```

---

## STEP 2: Server Actions — `lib/actions/mistakes.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { getMistakeAnalytics, analyzeMistake, generateMarkLossReport } from '@/lib/engines/mistake-engine';

export async function getMistakeData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getMistakeAnalytics(user.id);
}

export async function logMistake(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const mistakeData = {
    user_id: user.id,
    subject: formData.get('subject') as string,
    chapter: formData.get('chapter') as string,
    topic: formData.get('topic') as string || '',
    category: formData.get('category') as string,
    question_text: formData.get('questionText') as string || null,
    user_answer: formData.get('userAnswer') as string || null,
    correct_answer: formData.get('correctAnswer') as string || null,
    marks_lost: parseFloat(formData.get('marksLost') as string) || 4,
    total_marks: parseFloat(formData.get('totalMarks') as string) || 4,
    time_spent_seconds: parseInt(formData.get('timeSpent') as string) || null,
  };

  // Get AI analysis
  const analysis = await analyzeMistake({
    subject: mistakeData.subject,
    chapter: mistakeData.chapter,
    questionText: mistakeData.question_text || undefined,
    userAnswer: mistakeData.user_answer || undefined,
    correctAnswer: mistakeData.correct_answer || undefined,
    category: mistakeData.category,
  });

  const { error } = await supabase.from('mistakes').insert({
    ...mistakeData,
    ai_analysis: (analysis as any)?.rootCause || null,
    improvement_suggestion: (analysis as any)?.fixStrategy || null,
  });

  if (error) return { error: error.message };
  return { success: true, analysis };
}

export async function getMarkLossReport() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return generateMarkLossReport(user.id);
}
```

---

## STEP 3: Mistakes Page — `app/(dashboard)/mistakes/page.tsx`

```tsx
import { getMistakeData } from '@/lib/actions/mistakes';
import MistakeDashboard from '@/components/mistakes/MistakeDashboard';

export default async function MistakesPage() {
  const data = await getMistakeData();
  return <MistakeDashboard data={data} />;
}
```

---

## STEP 4: Mistake Dashboard Component — `components/mistakes/MistakeDashboard.tsx`

```tsx
'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { logMistake } from '@/lib/actions/mistakes';
import { Target, Plus, TrendingDown, AlertTriangle, Zap } from 'lucide-react';
import { NEET_SUBJECTS, NEET_CHAPTERS } from '@/lib/utils/constants';

const CATEGORIES = [
  { value: 'conceptual', label: 'Conceptual', color: 'red' as const },
  { value: 'calculation', label: 'Calculation', color: 'yellow' as const },
  { value: 'silly', label: 'Silly Mistake', color: 'purple' as const },
  { value: 'time_pressure', label: 'Time Pressure', color: 'blue' as const },
  { value: 'recall_failure', label: 'Recall Failure', color: 'cyan' as const },
  { value: 'anxiety', label: 'Anxiety', color: 'red' as const },
  { value: 'overconfidence', label: 'Overconfidence', color: 'yellow' as const },
  { value: 'misread', label: 'Misread', color: 'gray' as const },
  { value: 'incomplete_knowledge', label: 'Incomplete Knowledge', color: 'red' as const },
];

export default function MistakeDashboard({ data }: { data: any }) {
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('Physics');
  const [loading, setLoading] = useState(false);

  const { mistakes = [], patterns = [], totalMarksLost = 0, subjectBreakdown = {} } = data || {};

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    await logMistake(formData);
    setLoading(false);
    setShowForm(false);
    window.location.reload();
  }

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
            <Target size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--danger)' }} />
            Mistake Intelligence
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            Understand why you lose marks. Fix patterns. Recover scores.
          </p>
        </div>
        <Button id="log-mistake-btn" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Log Mistake
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid-3 stagger">
        <Card variant="glow">
          <div className="label">Total Marks Lost</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
            -{totalMarksLost}
          </div>
        </Card>
        <Card>
          <div className="label">Mistakes Logged</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
            {mistakes.length}
          </div>
        </Card>
        <Card>
          <div className="label">Top Issue</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 'var(--sp-1)' }}>
            {patterns[0]?.category?.replace('_', ' ') || 'None yet'}
          </div>
        </Card>
      </div>

      {/* Log Mistake Form */}
      {showForm && (
        <Card padding="lg" className="animate-fade">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>Log a Mistake</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Subject</label>
              <select name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={{
                width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
              }}>
                {NEET_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Chapter</label>
              <select name="chapter" style={{
                width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
              }}>
                {(NEET_CHAPTERS[subject] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Mistake Category</label>
              <select name="category" style={{
                width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
              }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Marks Lost</label>
              <input name="marksLost" type="number" defaultValue={4} style={{
                width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
              }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Question (optional)</label>
              <textarea name="questionText" rows={2} style={{
                width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontFamily: 'var(--font-sans)', resize: 'vertical',
              }} />
            </div>
            <input type="hidden" name="totalMarks" value="4" />
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" isLoading={loading}>Log & Analyze</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Pattern Breakdown */}
      {patterns.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            <AlertTriangle size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--warning)' }} />
            Mistake Patterns
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {patterns.map((p: any) => {
              const cat = CATEGORIES.find(c => c.value === p.category);
              return (
                <div key={p.category} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                  padding: 'var(--sp-3)', background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <Badge color={cat?.color || 'gray'}>{p.category.replace('_', ' ')}</Badge>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      height: 6, borderRadius: 3, background: 'var(--bg-hover)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: `${p.percentage}%`,
                        background: 'var(--danger)', borderRadius: 3,
                      }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                    {p.count}x
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--danger)' }}>
                    -{p.marksLost}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Mistakes */}
      {mistakes.length > 0 && (
        <Card>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            Recent Mistakes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {mistakes.slice(0, 10).map((m: any) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                padding: 'var(--sp-3)', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <Badge color={CATEGORIES.find(c => c.value === m.category)?.color || 'gray'}>
                  {m.category.replace('_', ' ')}
                </Badge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>
                    {m.subject} — {m.chapter}
                  </div>
                  {m.ai_analysis && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {m.ai_analysis}
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--danger)' }}>
                  -{m.marks_lost}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {mistakes.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
          <Target size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto var(--sp-4)' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)' }}>No mistakes logged yet</p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-1)' }}>
            Start logging mistakes to unlock pattern intelligence
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
# 1. Go to /dashboard/mistakes
# 2. See empty state with CTA
# 3. Click "Log Mistake" — form appears with subject/chapter/category selectors
# 4. Submit a mistake — should get AI analysis and appear in recent list
# 5. Pattern breakdown should populate after multiple mistakes
```

**→ NEXT: MODULE 7 (Revision Engine)**
