'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/lib/actions/onboarding';
import { EXAM_REGISTRY, getExamConfig } from '@/lib/utils/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Zap, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({
    examType: 'NEET', targetYear: '2026', targetScore: '', studyHours: '8',
  });
  const router = useRouter();

  const examConfig = getExamConfig(formState.examType);

  async function handleComplete() {
    setLoading(true);
    const fd = new FormData();
    Object.entries(formState).forEach(([k, v]) => fd.set(k, v));
    await completeOnboarding(fd);
    router.push('/dashboard');
  }

  const steps = [
    // Step 0: Welcome
    <div key={0} style={{ textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--radius-lg)', margin: '0 auto var(--sp-6)',
        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Zap size={32} color="white" /></div>
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>
        Welcome to <span style={{ color: 'var(--accent-blue)' }}>Cognition OS</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', maxWidth: 400, margin: '0 auto var(--sp-6)' }}>
        Let's set up your AI academic operating system. This takes 30 seconds.
      </p>
      <Button onClick={() => setStep(1)} size="lg">Get Started <ArrowRight size={18} /></Button>
    </div>,
    // Step 1: Exam & Target
    <div key={1} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Your Learning Goal</h2>
      <div>
        <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Exam Type</label>
        <select value={formState.examType} onChange={e => setFormState(p => ({ ...p, examType: e.target.value, targetScore: '' }))} style={{
          width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
        }}>
          {Object.entries(EXAM_REGISTRY).map(([key, config]) => (
            <option key={key} value={key}>{config.name}</option>
          ))}
        </select>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-1)' }}>
          Subjects: {examConfig.subjects.join(', ')}
        </p>
      </div>
      <Input label="Target Year" type="number" value={formState.targetYear}
        onChange={e => setFormState(p => ({ ...p, targetYear: e.target.value }))} />
      <Input label="Target Score" type="number" value={formState.targetScore}
        onChange={e => setFormState(p => ({ ...p, targetScore: e.target.value }))}
        placeholder={`Out of ${examConfig.totalMarks}`} />
      <Input label="Study Hours Per Day" type="number" value={formState.studyHours}
        onChange={e => setFormState(p => ({ ...p, studyHours: e.target.value }))} />
      <Button onClick={handleComplete} isLoading={loading} size="lg" style={{ marginTop: 'var(--sp-4)' }}>
        Launch Cognition OS <Zap size={18} />
      </Button>
    </div>,
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--header-height) - var(--sp-12))',
    }}>
      <Card padding="lg" style={{ maxWidth: 480, width: '100%' }} className="animate-fade">
        {steps[step]}
      </Card>
    </div>
  );
}
