'use client';

import { useState, useEffect } from 'react';
import { logMockTest } from '@/lib/actions/ingest';
import { getExamConfig } from '@/lib/utils/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LogTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [examType, setExamType] = useState('NEET');
  const examConfig = getExamConfig(examType);

  // Detect exam type from profile (loaded via a hidden fetch or passed via URL)
  // For now allow the user to select
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    // Build subject-wise data dynamically from the user's exam subjects
    const subjectWise = examConfig.subjects.map(sub => ({
      subject: sub,
      correct: parseInt(formData.get(`${sub}-correct`) as string) || 0,
      incorrect: parseInt(formData.get(`${sub}-incorrect`) as string) || 0,
      unattempted: parseInt(formData.get(`${sub}-unattempted`) as string) || 0,
      marks: ((parseInt(formData.get(`${sub}-correct`) as string) || 0) * examConfig.correctMarks) +
             ((parseInt(formData.get(`${sub}-incorrect`) as string) || 0) * examConfig.negativeMarks),
    }));
    formData.set('subjectWise', JSON.stringify(subjectWise));

    // Calculate totals
    const correct = subjectWise.reduce((s, x) => s + x.correct, 0);
    const incorrect = subjectWise.reduce((s, x) => s + x.incorrect, 0);
    const marks = subjectWise.reduce((s, x) => s + x.marks, 0);
    formData.set('correct', correct.toString());
    formData.set('incorrect', incorrect.toString());
    formData.set('attempted', (correct + incorrect).toString());
    formData.set('marksObtained', marks.toString());
    formData.set('negativeMarks', (Math.abs(incorrect * examConfig.negativeMarks)).toString());

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
          <Input name="testName" label="Test Name" placeholder="e.g. Mock Test 5" required />
          <div className="grid-2">
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Exam Type</label>
              <select value={examType} onChange={e => setExamType(e.target.value)} style={{
                width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
              }}>
                <option value="NEET">NEET</option>
                <option value="JEE">JEE</option>
                <option value="SAT">SAT</option>
                <option value="UPSC">UPSC</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <Input name="totalQuestions" label="Total Questions" type="number" defaultValue={examConfig.totalQuestions} />
            <Input name="totalMarks" label="Total Marks" type="number" defaultValue={examConfig.totalMarks} />
            <Input name="timeTaken" label="Time Taken (min)" type="number" defaultValue={examConfig.durationMinutes} />
          </div>

          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border-subtle)' }}>
            Subject-wise Breakdown
          </h3>

          {examConfig.subjects.map(sub => (
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
