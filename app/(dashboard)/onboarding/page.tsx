'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Brain, Calendar, Upload, Loader2, Target } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { completeOnboarding } from '@/lib/actions/onboarding';

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // State
  const [examType, setExamType] = useState('');
  const [examDate, setExamDate] = useState('');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  
  // Quiz State
  const [quizData, setQuizData] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [quizResults, setQuizResults] = useState<Array<{ chapter: string; concept: string; isCorrect: boolean }>>([]);
  const [quizLoading, setQuizLoading] = useState(false);

  // Recalculate days remaining when date changes
  useEffect(() => {
    if (examDate) {
      const days = Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 3600 * 24)));
      setDaysRemaining(days);
    }
  }, [examDate]);

  // Handle Quiz Fetch
  const startQuiz = async () => {
    setStep(4);
    setQuizLoading(true);
    try {
      const res = await fetch('/api/onboarding/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType })
      });
      const data = await res.json();
      if (data.questions) setQuizData(data.questions);
    } catch (e) {
      console.error(e);
    } finally {
      setQuizLoading(false);
    }
  };

  // Handle Quiz Answer
  const handleAnswer = async (selectedIndex: number) => {
    const q = quizData[currentQ];
    const isCorrect = selectedIndex === q.correctIndex;
    
    const newResults = [...quizResults, { chapter: q.chapter, concept: q.concept, isCorrect }];
    setQuizResults(newResults);

    if (currentQ < quizData.length - 1) {
      setCurrentQ(prev => prev + 1);
    } else {
      // Finish Quiz & Submit Onboarding
      setStep(5);
      setLoading(true);
      try {
        await completeOnboarding('temp-id-ignored-by-server', examType, examDate, newResults);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

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
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>Enter your exam, degree, or skill.</p>
              </div>
              <input
                autoFocus
                value={examType}
                onChange={e => setExamType(e.target.value)}
                placeholder="e.g. NEET, CFA Level 1, USMLE..."
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

        {/* STEP 2: Exam Date */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ width: '100%', maxWidth: 480 }}>
            <Card padding="lg" variant="glow">
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                <Calendar size={48} style={{ color: 'var(--accent-cyan)', margin: '0 auto var(--sp-4)' }} />
                <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)' }}>When is the exam?</h2>
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
                    <div style={{ textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-2)' }}>Days Remaining</div>
                    <div style={{ color: 'var(--success)', fontWeight: 'var(--fw-medium)' }}>That is enough time if we start now.</div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button onClick={() => setStep(3)} disabled={!examDate} style={{ width: '100%', marginTop: 'var(--sp-6)', padding: '16px', background: 'var(--accent-cyan)', color: 'black' }}>
                Next <ArrowRight size={18} />
              </Button>
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
                <Button variant="secondary" onClick={startQuiz} style={{ flex: 1 }}>Skip for now</Button>
                <Button onClick={startQuiz} style={{ flex: 1 }}>Continue <ArrowRight size={16}/></Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* STEP 4: Two-Minute Calibration Quiz */}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: 600 }}>
            <Card padding="lg" variant="glow" style={{ border: '1px solid var(--accent-purple-dim)', boxShadow: 'var(--shadow-glow-purple)' }}>
              
              {quizLoading ? (
                <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
                  <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-4)' }} />
                  <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold' }}>Generating Calibration Check...</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>MIND is analyzing {examType} to find 5 foundational concepts.</p>
                </div>
              ) : quizData.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
                    <span>Diagnostic Calibration</span>
                    <span>{currentQ + 1} of 5</span>
                  </div>
                  
                  <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', lineHeight: 'var(--lh-relaxed)', marginBottom: 'var(--sp-8)' }}>
                    {quizData[currentQ].question}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {quizData[currentQ].options.map((opt: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        style={{
                          padding: 'var(--sp-4)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', textAlign: 'left', fontSize: 'var(--fs-md)',
                          cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: 'var(--sp-4)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--accent-purple)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                      >
                        <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>Failed to load quiz. <Button onClick={() => setStep(5)}>Skip Calibration</Button></div>
              )}
            </Card>
          </motion.div>
        )}

        {/* STEP 5: The Reveal (Knowledge Graph & Redirect) */}
        {step === 5 && (
          <motion.div key="step5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} style={{ width: '100%', maxWidth: 800, textAlign: 'center' }}>
            
            {loading ? (
              <div style={{ padding: 'var(--sp-12)' }}>
                <Brain size={64} className="animate-pulse" style={{ color: 'var(--accent-cyan)', margin: '0 auto var(--sp-6)' }} />
                <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-2)' }}>Building Your Brain Model...</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Processing diagnostics, scaling FSRS decay curves, and generating Day 1 mission.</p>
              </div>
            ) : (
              <div>
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}>
                  <Target size={64} style={{ color: 'var(--success)', margin: '0 auto var(--sp-4)', filter: 'drop-shadow(0 0 20px var(--success-dim))' }} />
                </motion.div>
                <h2 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', marginBottom: 'var(--sp-4)' }}>Calibration Complete.</h2>
                
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-6)', marginBottom: 'var(--sp-8)', display: 'inline-block', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'center' }}>
                    <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: 'var(--sp-6)' }}>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Strong Areas Found</div>
                      <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: 'var(--fs-lg)' }}>{quizResults.filter(r=>r.isCorrect).length} Concepts</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Weak Areas Found</div>
                      <div style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: 'var(--fs-lg)' }}>{quizResults.filter(r=>!r.isCorrect).length} Concepts</div>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)', maxWidth: 600, margin: '0 auto var(--sp-8)' }}>
                  This is where you stand today. Your ATLAS graph has been seeded. <br/>Your Day 1 mission is locked and waiting.
                </p>

                <Button size="lg" onClick={() => router.push('/dashboard')} style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', color: 'black', padding: '20px 40px', fontSize: 'var(--fs-lg)', fontWeight: 900, boxShadow: '0 10px 30px rgba(0, 240, 255, 0.3)' }}>
                  Enter Command Center <ArrowRight size={24} style={{ marginLeft: 8 }} />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
