'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { logMistake } from '@/lib/actions/mistakes';
import { Target, Plus, TrendingDown, AlertTriangle, Zap } from 'lucide-react';
import { getExamConfig } from '@/lib/utils/constants';

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
  
  const { mistakes = [], patterns = [], totalMarksLost = 0, subjectBreakdown = {}, examType = 'General' } = data || {};
  const examConfig = getExamConfig(examType);
  
  const [subject, setSubject] = useState(examConfig.subjects[0] || 'General');
  const [loading, setLoading] = useState(false);

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
                {examConfig.subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Chapter</label>
              <select name="chapter" style={{
                width: '100%', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
              }}>
                {(examConfig.chapters[subject] || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
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
