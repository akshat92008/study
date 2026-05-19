'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/lib/actions/onboarding';
import { EXAM_REGISTRY, getExamConfig } from '@/lib/utils/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowRight, Upload, Brain, Check } from 'lucide-react';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formState, setFormState] = useState({
    isSpecificExam: false, topic: '', academicLevel: 'University',
    examType: 'NEET', targetYear: '2026', targetScore: '', studyHours: '8',
  });
  const [weakSpots, setWeakSpots] = useState<Record<string, string[]>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ seeded: number; tasksCreated: number } | null>(null);

  const examConfig = getExamConfig(formState.examType);

  const toggleWeakChapter = (subject: string, chapter: string) => {
    setWeakSpots(prev => {
      const current = prev[subject] || [];
      const next = current.includes(chapter)
        ? current.filter(c => c !== chapter)
        : [...current, chapter];
      return { ...prev, [subject]: next };
    });
  };

  async function handleUpload() {
    if (!uploadedFile) { setStep(3); return; }
    // Ingest uploaded material
    const formData = new FormData();
    formData.append('file', uploadedFile);
    try {
      await fetch('/api/ingest', { method: 'POST', body: formData });
    } catch { /* non-critical */ }
    setStep(3);
  }

  async function handleComplete() {
    setLoading(true);
    try {
      const res = await completeOnboarding(
        '', // userId is resolved server-side from the session
        formState.examType,
        parseInt(formState.targetYear),
        weakSpots
      );
      setResult(res);
      setStep(4); // magic moment
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalWeak = Object.values(weakSpots).reduce((sum, arr) => sum + arr.length, 0);

  const steps = [
    // Step 0: Welcome
    <motion.div key={0} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 'var(--radius-xl)', margin: '0 auto var(--sp-6)',
        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-glow-blue)',
      }}><Zap size={36} color="white" /></div>
      <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-2)' }}>
        Welcome to <span style={{ color: 'var(--accent-blue)' }}>Cognition OS</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)', maxWidth: 400, margin: '0 auto var(--sp-8)' }}>
        Your AI academic operating system. 60 seconds to set up. A lifetime of strategic advantage.
      </p>
      <Button onClick={() => setStep(1)} size="lg">Get Started <ArrowRight size={18} /></Button>
    </motion.div>,

    // Step 1: Exam & Target
    <motion.div key={1} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)', marginBottom: 'var(--sp-1)' }}>Step 1 of 4</div>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>What are you working toward?</h2>
      </div>
      <Input 
        label="What do you want to learn?" 
        value={formState.topic} 
        onChange={(e: any) => setFormState(p => ({ ...p, topic: e.target.value }))}
        placeholder="e.g. Quantum Physics, CFA Level 1, React Native" 
      />
      <div>
        <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Academic Level</label>
        <select value={formState.academicLevel} onChange={e => setFormState(p => ({ ...p, academicLevel: e.target.value }))} style={{
          width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
        }}>
          <option value="High School">High School</option>
          <option value="University">Undergraduate / University</option>
          <option value="Graduate">Masters / Ph.D. / Graduate</option>
          <option value="Professional">Professional Certification</option>
          <option value="Hobbyist">Hobbyist / Self-Taught</option>
        </select>
      </div>

      <Button 
        onClick={async () => {
          if (!formState.topic) return;
          setLoading(true);
          try {
            const { generateDynamicCurriculum } = await import('@/lib/actions/curriculum');
            await generateDynamicCurriculum(formState.topic, formState.academicLevel);
            router.push('/');
            router.refresh();
          } catch (err) {
            console.error(err);
          } finally {
            setLoading(false);
          }
        }} 
        isLoading={loading}
        size="lg" 
        style={{ marginTop: 'var(--sp-2)' }}
      >
        Build My Learning Engine {!loading && <ArrowRight size={18} />}
      </Button>
    </motion.div>,

    // Step 2: Upload Material
    <motion.div key={2} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)', marginBottom: 'var(--sp-1)' }}>Step 2 of 4</div>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Upload your study material</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>PDF, notes, textbook chapters — the AI will learn from your material.</p>
      </div>
      <div style={{
        border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-10)', textAlign: 'center', cursor: 'pointer',
        background: uploadedFile ? 'var(--success-dim)' : 'var(--bg-tertiary)',
        transition: 'all 200ms ease',
      }}>
        <Upload size={32} style={{ color: uploadedFile ? 'var(--success)' : 'var(--text-tertiary)', margin: '0 auto var(--sp-3)' }} />
        <input type="file" accept=".pdf,.txt,.md,.doc,.docx" onChange={e => setUploadedFile(e.target.files?.[0] || null)}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} id="file-upload" />
        <label htmlFor="file-upload" style={{ cursor: 'pointer', color: uploadedFile ? 'var(--success)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          {uploadedFile ? `✓ ${uploadedFile.name}` : 'Click to upload or drag file here'}
        </label>
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        <Button variant="ghost" onClick={() => setStep(3)} style={{ flex: 1 }}>Skip for now</Button>
        <Button onClick={handleUpload} style={{ flex: 1 }}>Next <ArrowRight size={18} /></Button>
      </div>
    </motion.div>,

    // Step 3: Weak Spots Self-Assessment
    <motion.div key={3} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)', marginBottom: 'var(--sp-1)' }}>Step 3 of 4</div>
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Which topics feel weakest?</h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>Tap the chapters you struggle with. This seeds your knowledge graph.</p>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {examConfig.subjects.map(subject => (
          <div key={subject}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-bold)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-2)' }}>
              {subject}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {(examConfig.chapters[subject] || []).slice(0, 12).map(chapter => {
                const isSelected = weakSpots[subject]?.includes(chapter);
                return (
                  <button
                    key={chapter}
                    onClick={() => toggleWeakChapter(subject, chapter)}
                    style={{
                      padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-medium)',
                      background: isSelected ? 'var(--danger-dim)' : 'var(--bg-tertiary)',
                      color: isSelected ? 'var(--danger)' : 'var(--text-secondary)',
                      border: `1px solid ${isSelected ? 'var(--danger)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                  >
                    {chapter}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
        {totalWeak} weak spots selected
      </p>
      <Button onClick={handleComplete} isLoading={loading} size="lg">
        Launch Cognition OS <Zap size={18} />
      </Button>
    </motion.div>,

    // Step 4: The Magic Moment
    <motion.div key={4} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.3 }}
        style={{
          width: 72, height: 72, borderRadius: 'var(--radius-full)',
          background: 'var(--success-dim)', margin: '0 auto var(--sp-6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-success)',
        }}
      ><Check size={36} style={{ color: 'var(--success)' }} /></motion.div>
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-2)' }}>
        You're Ready.
      </h2>
      {result && (
        <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', lineHeight: 'var(--lh-relaxed)' }}>
          <p><strong style={{ color: 'var(--accent-cyan)' }}>{result.seeded}</strong> concepts mapped to your knowledge graph.</p>
          <p><strong style={{ color: 'var(--success)' }}>{result.tasksCreated}</strong> tasks in your Day 1 mission.</p>
          <p style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
            The OS knows you now. Let&apos;s go win.
          </p>
        </div>
      )}
      <Button onClick={() => router.push('/')} size="lg">
        Enter Command Center <ArrowRight size={18} />
      </Button>
    </motion.div>,
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--header-height) - var(--sp-12))',
    }}>
      <Card padding="lg" style={{ maxWidth: 520, width: '100%' }} className="animate-fade">
        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
      </Card>
    </div>
  );
}
