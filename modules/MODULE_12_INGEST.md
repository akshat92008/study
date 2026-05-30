# MODULE 12: Input/Ingest Layer (Mock Tests)

## PROMPT FOR AI BUILDER

```
Build the mock test input system for Cognition OS. Students enter mock test results
which feeds the entire analytics + mistake + cognition pipeline.
Create a form to log mock test results with per-question breakdown.
```

---

## STEP 1: Server Action — `lib/actions/ingest.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';

export async function logMockTest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const testData = {
    user_id: user.id,
    test_name: formData.get('testName') as string,
    total_questions: parseInt(formData.get('totalQuestions') as string) || 200,
    attempted: parseInt(formData.get('attempted') as string) || 0,
    correct: parseInt(formData.get('correct') as string) || 0,
    incorrect: parseInt(formData.get('incorrect') as string) || 0,
    total_marks: parseFloat(formData.get('totalMarks') as string) || 720,
    marks_obtained: parseFloat(formData.get('marksObtained') as string) || 0,
    negative_marks: parseFloat(formData.get('negativeMarks') as string) || 0,
    time_taken: parseInt(formData.get('timeTaken') as string) || 0,
    total_time: 200,
    subject_wise: JSON.parse(formData.get('subjectWise') as string || '[]'),
  };

  testData.unattempted = testData.total_questions - testData.attempted;

  const { error } = await supabase.from('mock_tests').insert(testData);
  if (error) return { error: error.message };

  // Auto-generate AI insights about the test
  const prompt = `NEET Mock Test Analysis:
Score: ${testData.marks_obtained}/${testData.total_marks}
Correct: ${testData.correct}, Incorrect: ${testData.incorrect}, Unattempted: ${testData.unattempted}
Time: ${testData.time_taken}/${testData.total_time} minutes

Give a brief 2-sentence strategic assessment.`;

  const insight = await generateJSON<{ assessment: string }>('flash',
    'You are a NEET exam analyst.', prompt + '\nRespond as: {"assessment": "..."}');

  return { success: true, insight: (insight as any)?.assessment };
}
```

---

## STEP 2: Page with Inline Form — `app/(dashboard)/analytics/log-test/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { logMockTest } from '@/lib/actions/ingest';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LogTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    // Build subject-wise data
    const subjectWise = ['Physics', 'Chemistry', 'Biology'].map(sub => ({
      subject: sub,
      correct: parseInt(formData.get(`${sub}-correct`) as string) || 0,
      incorrect: parseInt(formData.get(`${sub}-incorrect`) as string) || 0,
      unattempted: parseInt(formData.get(`${sub}-unattempted`) as string) || 0,
      marks: ((parseInt(formData.get(`${sub}-correct`) as string) || 0) * 4) -
             ((parseInt(formData.get(`${sub}-incorrect`) as string) || 0) * 1),
    }));
    formData.set('subjectWise', JSON.stringify(subjectWise));

    // Calculate totals
    const correct = subjectWise.reduce((s, x) => s + x.correct, 0);
    const incorrect = subjectWise.reduce((s, x) => s + x.incorrect, 0);
    const marks = (correct * 4) - (incorrect * 1);
    formData.set('correct', correct.toString());
    formData.set('incorrect', incorrect.toString());
    formData.set('attempted', (correct + incorrect).toString());
    formData.set('marksObtained', marks.toString());
    formData.set('negativeMarks', (incorrect * 1).toString());

    const res = await logMockTest(formData);
    setResult(res);
    setLoading(false);
  }

  if (result?.success) {
    return (
      <div className="animate-fade" style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
        <Card padding="lg" style={{ maxWidth: 500, margin: '0 auto' }}>
          <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: 'var(--sp-4)' }}>✅</div>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-3)' }}>Test Logged</h2>
          {result.insight && <p style={{ color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>{result.insight}</p>}
          <Link href="/dashboard/analytics"><Button style={{ marginTop: 'var(--sp-6)' }}>View Analytics</Button></Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade" style={{ maxWidth: 700, margin: '0 auto' }}>
      <Link href="/dashboard/analytics" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
        <ArrowLeft size={14} /> Back to Analytics
      </Link>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-6)' }}>
        <FileText size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-blue)' }} />
        Log Mock Test
      </h1>

      <form onSubmit={handleSubmit}>
        <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Input name="testName" label="Test Name" placeholder="e.g. Allen Mock Test 5" required />
          <div className="grid-2">
            <Input name="totalQuestions" label="Total Questions" type="number" defaultValue={200} />
            <Input name="totalMarks" label="Total Marks" type="number" defaultValue={720} />
            <Input name="timeTaken" label="Time Taken (min)" type="number" defaultValue={180} />
          </div>

          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border-subtle)' }}>
            Subject-wise Breakdown
          </h3>

          {['Physics', 'Chemistry', 'Biology'].map(sub => (
            <div key={sub}>
              <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-2)', color: 'var(--accent-blue)' }}>{sub}</p>
              <div className="grid-3">
                <Input name={`${sub}-correct`} label="Correct" type="number" defaultValue={0} />
                <Input name={`${sub}-incorrect`} label="Incorrect" type="number" defaultValue={0} />
                <Input name={`${sub}-unattempted`} label="Unattempted" type="number" defaultValue={0} />
              </div>
            </div>
          ))}

          <Button type="submit" isLoading={loading} size="lg" style={{ marginTop: 'var(--sp-4)' }}>
            Log Test & Analyze
          </Button>
        </Card>
      </form>
    </div>
  );
}
```

---

## VERIFICATION

```bash
npm run dev
# Visit /dashboard/analytics/log-test
# Fill out mock test form, submit
# Should save to DB and show AI insight
# Check /dashboard/analytics — score trend chart should populate
```

**→ NEXT: MODULE 13 (Command Center)**
