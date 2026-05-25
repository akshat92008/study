'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Brain, Calendar, Upload, Loader2, Target, CheckCircle } from 'lucide-react';
import WeakSpotCheck from '@/components/onboarding/WeakSpotCheck';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { completeOnboarding } from '@/lib/actions/onboarding';
import { logger } from '@/lib/utils/logger';

// Rotating status messages shown during quiz generation so the UI
// communicates active work even when the first question hasn't arrived yet.


export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<number | string>(1);
  const [loading, setLoading] = useState(false);
  const [conceptsSeeded, setConceptsSeeded] = useState(0);

  const [examType, setExamType] = useState('');
  const [examDate, setExamDate] = useState('');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Store results from weak spot check
  const [quizResults, setQuizResults] = useState<Array<{ chapter: string; concept: string; isCorrect: boolean }>>([]);

  useEffect(() => {
    if (examDate) {
      const days = Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 3600 * 24)));
      setDaysRemaining(days);
    }
  }, [examDate]);

  useEffect(() => {
    if (step === 'done') {
      const timer = setTimeout(() => {
        router.push('/dashboard?magic=true'); // magic=true opens ATLAS drawer
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  const handleWeakSpotComplete = async (
    results: Array<{ chapter: string; concept: string; isCorrect: boolean }>
  ) => {
    setQuizResults(results);
    setStep('processing'); // Show processing state immediately

    try {
      // 1. Save quiz results to server action
      await completeOnboarding('server-uses-auth', examType, examDate, results);

      // 2. Call the seeding API with quiz results — AWAIT this
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizResults: results }),
      });

      const data = await response.json();

      if (data.success) {
        setConceptsSeeded(data.conceptsSeeded || 0);
        setStep('done');
      } else {
        // Even if there's an error, move forward — don't block the user
        setStep('done');
      }
    } catch (err) {
      logger.error('Onboarding completion failed', err);
      setStep('done'); // Always move forward
    }
  };

  if (step === 'processing') {
    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', gap: 'var(--sp-6)'
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'conic-gradient(var(--accent-purple) 0%, var(--accent-blue) 100%)',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900 }}>
          Building your knowledge map...
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center' }}>
          Processing your diagnostic results, seeding your ATLAS graph, 
          and generating your Day 1 mission.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-root)', padding: 'var(--sp-4)'
    }}>
      <AnimatePresence mode="wait">

        {/* STEP 1: What are you studying? */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ width: '100%', maxWidth: 480 }}>
            <Card padding="lg" variant="glow">
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
                <Brain size={48} style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-4)' }} />
                <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)' }}>What are you studying?</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>Can be anything — a subject, exam, skill, or course.</p>
              </div>
              <input
                autoFocus
                value={examType}
                onChange={e => setExamType(e.target.value)}
                placeholder="e.g. Class 10 Maths, React, Spanish, History..."
                onKeyDown={e => { if (e.key === 'Enter' && examType) setStep(2); }}
                style={{
                  width: '100%', padding: '16px', background: 'var(--bg-tertiary)', color: 'white',
                  border: '1px solid var(--border-focus)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-lg)', textAlign: 'center', outline: 'none'
                }}
              />
              <Button onClick={() => setStep(2)} disabled={!examType} style={{ width: '100%', marginTop: 'var(--sp-6)', padding: '16px' }}>
                Next <ArrowRight size={18} />
              </Button>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Target Date (optional) */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ width: '100%', maxWidth: 480 }}>
            <Card padding="lg" variant="glow">
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                <Calendar size={48} style={{ color: 'var(--accent-cyan)', margin: '0 auto var(--sp-4)' }} />
                <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)' }}>Set a target date</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
                  An exam, a deadline, or just when you want to feel ready. You can skip this.
                </p>
              </div>

              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                style={{
                  width: '100%', padding: '16px', background: 'var(--bg-tertiary)', color: 'white',
                  border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-lg)', textAlign: 'center', outline: 'none', colorScheme: 'dark'
                }}
              />

              <AnimatePresence>
                {daysRemaining !== null && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ textAlign: 'center', marginTop: 'var(--sp-6)', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{daysRemaining}</div>
                    <div style={{ textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-2)' }}>Days to target</div>
                    <div style={{ color: 'var(--success)', fontWeight: 'var(--fw-medium)' }}>Enough time if we start now.</div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
                <Button
                  onClick={() => setStep(3)}
                  style={{ flex: 1, padding: '14px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  Skip for now
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!examDate}
                  style={{ flex: 2, padding: '14px', background: 'var(--accent-cyan)', color: 'black' }}
                >
                  Set Date <ArrowRight size={18} />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* STEP 3: Upload Material (Optional) */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ width: '100%', maxWidth: 480 }}>
            <Card padding="lg">
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                <Upload size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto var(--sp-4)' }} />
                <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)' }}>Upload your material</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>Drop your syllabus, notes, or past papers here. The AI will read them and customize your curriculum.</p>
              </div>

              <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-8)', textAlign: 'center', background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'var(--fw-medium)' }}>Click to browse or drag & drop</span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
                <Button variant="secondary" onClick={() => setStep(4)} style={{ flex: 1 }}>Skip for now</Button>
                <Button onClick={() => setStep(4)} style={{ flex: 1 }}>Continue <ArrowRight size={16} /></Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* STEP 4: Two-Minute Calibration Quiz */}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: 600 }}>
            <WeakSpotCheck examType={examType} onComplete={handleWeakSpotComplete} />
          </motion.div>
        )}

        {/* STEP 5: The Reveal (Knowledge Graph & Redirect) */}
        {step === 'done' && (
          <motion.div key="step5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} style={{ width: '100%', maxWidth: 800, textAlign: 'center' }}>
            <div>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}>
                <Target size={64} style={{ color: 'var(--success)', margin: '0 auto var(--sp-4)', filter: 'drop-shadow(0 0 20px var(--success-dim))' }} />
              </motion.div>
              <h2 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-4)' }}>Calibration Complete.</h2>

              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-6)', marginBottom: 'var(--sp-8)', display: 'inline-block', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'center' }}>
                  <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: 'var(--sp-6)' }}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Strong Areas Found</div>
                    <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: 'var(--fs-lg)' }}>{quizResults.filter(r => r.isCorrect).length} Concepts</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Weak Areas Found</div>
                    <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: 'var(--fs-lg)' }}>{quizResults.filter(r => !r.isCorrect).length} Concepts</div>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)', maxWidth: 600, margin: '0 auto var(--sp-8)' }}>
                This is where you stand today. Your ATLAS graph has been seeded. <br />Your Day 1 mission is locked and waiting.
              </p>

              <Button size="lg" onClick={() => router.push('/dashboard?magic=true')} style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', color: 'black', padding: '20px 40px', fontSize: 'var(--fs-lg)', fontWeight: 900, boxShadow: '0 10px 30px rgba(0, 240, 255, 0.3)' }}>
                See Your Knowledge Graph <ArrowRight size={24} style={{ marginLeft: 8 }} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
