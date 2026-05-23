'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { FileText, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function LogTestPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    testName: '',
    totalQuestions: '',
    correct: '',
    incorrect: '',
    totalMarks: '',
    marksObtained: '',
    notes: '',
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/mistakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testName: form.testName,
          totalQuestions: Number(form.totalQuestions) || 0,
          correct: Number(form.correct) || 0,
          incorrect: Number(form.incorrect) || 0,
          totalMarks: Number(form.totalMarks) || 100,
          marksObtained: Number(form.marksObtained) || 0,
          notes: form.notes,
        }),
      });
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontSize: 'var(--fs-sm)', outline: 'none',
  };

  if (done) return (
    <div style={{ padding: 'var(--sp-6)', maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto var(--sp-4)' }} />
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', marginBottom: 8 }}>Test logged.</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
        Your results are saved. Upload the test paper to Autopsy for a full mistake breakdown.
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center' }}>
        <Link href="/autopsy">
          <Button>Run Autopsy</Button>
        </Link>
        <Button variant="secondary" onClick={() => { setDone(false); setForm({ testName:'',totalQuestions:'',correct:'',incorrect:'',totalMarks:'',marksObtained:'',notes:'' }); }}>
          Log Another
        </Button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 'var(--sp-6)', maxWidth: 560, margin: '0 auto' }}>
      <Link href="/analytics" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-6)', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', marginBottom: 4 }}>Log a Test</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          Record your score. For full mistake analysis, use Autopsy with the actual paper.
        </p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Test Name</label>
            <input style={inputStyle} placeholder="e.g. Chapter 5 Test, Mid-term Mock, Practice Paper 3" value={form.testName} onChange={e => set('testName', e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Total Questions</label>
              <input style={inputStyle} type="number" min="0" placeholder="e.g. 50" value={form.totalQuestions} onChange={e => set('totalQuestions', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Total Marks</label>
              <input style={inputStyle} type="number" min="0" placeholder="e.g. 100" value={form.totalMarks} onChange={e => set('totalMarks', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--success)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Correct</label>
              <input style={inputStyle} type="number" min="0" placeholder="0" value={form.correct} onChange={e => set('correct', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--danger)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Wrong</label>
              <input style={inputStyle} type="number" min="0" placeholder="0" value={form.incorrect} onChange={e => set('incorrect', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Marks Obtained</label>
            <input style={inputStyle} type="number" placeholder="Your actual score" value={form.marksObtained} onChange={e => set('marksObtained', e.target.value)} required />
          </div>

          <div>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="What felt hard? What did you run out of time on?" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <Button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', marginTop: 4 }}>
            {loading ? 'Saving...' : 'Save Test Results'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
