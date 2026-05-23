'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Brain, Calendar, Upload, Loader2, Target, CheckCircle } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { completeOnboarding } from '@/lib/actions/onboarding';

// Rotating status messages shown during quiz generation so the UI
// communicates active work even when the first question hasn't arrived yet.
const CALIBRATION_STATUS_MESSAGES = [
  'Mapping your exam syllabus...',
  'Identifying high-yield foundational concepts...',
  'Generating Question 1...',
  'Generating Question 2...',
  'Generating Question 3...',
  'Generating Question 4...',
  'Generating Question 5...',
  'Finalising calibration set...',
];

export default function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [examType, setExamType] = useState('');
  const [examDate, setExamDate] = useState('');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Quiz state
  const [quizData, setQuizData] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [quizResults, setQuizResults] = useState<Array<{ chapter: string; concept: string; isCorrect: boolean }>>([]);

  // FIX 3: streaming generation state
  const [quizStreaming, setQuizStreaming] = useState(false);   // true while stream is open
  const [calibrationStatus, setCalibrationStatus] = useState(CALIBRATION_STATUS_MESSAGES[0]);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // FIX 4: selected-answer state — tracks which option was clicked before advancing
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false); // true during 500ms delay

  useEffect(() => {
    if (examDate) {
      const days = Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 3600 * 24)));
      setDaysRemaining(days);
    }
  }, [examDate]);

  // Clean up the status rotator on unmount
  useEffect(() => {
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  // ── FIX 3: Stream questions one-by-one from the backend ──────────────────
  // The backend now emits newline-delimited JSON (one question per line).
  // We parse each line and add it to quizData immediately, so the first
  // question can appear within ~2 seconds instead of waiting 2+ minutes
  // for the full batch.
  const startQuiz = async () => {
    setStep(4);
    setQuizData([]);
    setCurrentQ(0);
    setQuizResults([]);
    setSelectedAnswer(null);
    setIsAdvancing(false);
    setQuizStreaming(true);

    // Rotate status messages so the user can see active progress
    let statusIdx = 0;
    statusIntervalRef.current = setInterval(() => {
      statusIdx = Math.min(statusIdx + 1, CALIBRATION_STATUS_MESSAGES.length - 1);
      setCalibrationStatus(CALIBRATION_STATUS_MESSAGES[statusIdx]);
    }, 1800);

    try {
      const res = await fetch('/api/onboarding/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examType }),
      });

      if (!res.ok || !res.body) throw new Error('Quiz stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Each question is terminated by '\n' — parse every complete line
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep the incomplete trailing fragment

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const question = JSON.parse(line);
            setQuizData(prev => [...prev, question]);
          } catch {
            // Malformed chunk — skip silently
          }
        }
      }
    } catch (e) {
      console.error('Quiz stream error:', e);
      // If streaming fails entirely, quizData will be empty — the existing
      // "Failed to load quiz" fallback UI handles this gracefully.
    } finally {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      setQuizStreaming(false);
    }
  };

  // ── FIX 4: Selected-state + 500ms delay before advancing ─────────────────
  const handleAnswer = (selectedIndex: number) => {
    if (isAdvancing) return; // Prevent double-click during delay

    setSelectedAnswer(selectedIndex);
    setIsAdvancing(true);

    setTimeout(async () => {
      const q = quizData[currentQ];
      const isCorrect = selectedIndex === q.correctIndex;

      const newResults = [...quizResults, { chapter: q.chapter, concept: q.concept, isCorrect }];
      setQuizResults(newResults);
      setSelectedAnswer(null);
      setIsAdvancing(false);

      if (currentQ < quizData.length - 1) {
        setCurrentQ(prev => prev + 1);
      } else {
        setStep(5);
        setLoading(true);
        try {
          await completeOnboarding('temp-id-ignored-by-server', examType, examDate, newResults);
          await fetch('/api/onboarding/complete', { method: 'POST' });
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }
    }, 500);
  };

  // Determine whether to show the quiz or the loading state.
  // Show questions as soon as the first one arrives (quizData.length > 0),
  // even if the stream is still open.
  const firstQuestionReady = quizData.length > 0;
  const showCalibrationLoader = quizStreaming && !firstQuestionReady;

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
                <Button onClick={startQuiz} style={{ flex: 1 }}>Continue <ArrowRight size={16} /></Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* STEP 4: Two-Minute Calibration Quiz */}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ width: '100%', maxWidth: 600 }}>
            <Card padding="lg" variant="glow" style={{ border: '1px solid var(--accent-purple-dim)', boxShadow: 'var(--shadow-glow-purple)' }}>

              {/* FIX 3: Granular loader — shown only until first question arrives */}
              {showCalibrationLoader ? (
                <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
                  <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-4)' }} />
                  <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold' }}>Generating Calibration Check...</h2>
                  {/* Rotating status — shows active progress instead of a dead spinner */}
                  <p style={{
                    color: 'var(--accent-purple)',
                    fontSize: 'var(--fs-sm)',
                    marginTop: 8,
                    fontFamily: 'var(--font-mono)',
                    transition: 'opacity 0.4s',
                  }}>
                    {calibrationStatus}
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-2)' }}>
                    Questions will appear as they're ready — you won't have to wait for all 5.
                  </p>
                </div>
              ) : firstQuestionReady ? (
                <div>
                  {/* Progress bar — fills as more questions become available */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
                    <span>Diagnostic Calibration</span>
                    <span>{currentQ + 1} of {quizData.length}{quizStreaming ? '…' : ''}</span>
                  </div>

                  {/* Mini progress dots */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-6)' }}>
                    {Array.from({ length: Math.max(quizData.length, 5) }).map((_, i) => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i < currentQ
                          ? 'var(--accent-purple)'
                          : i === currentQ
                            ? 'var(--accent-cyan)'
                            : i < quizData.length
                              ? 'var(--border-strong)'
                              : 'var(--bg-tertiary)',
                        transition: 'background 0.3s',
                      }} />
                    ))}
                  </div>

                  <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', lineHeight: 'var(--lh-relaxed)', marginBottom: 'var(--sp-8)' }}>
                    {quizData[currentQ].question}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {quizData[currentQ].options.map((opt: string, i: number) => {
                      const isSelected = selectedAnswer === i;
                      const isCorrectAnswer = i === quizData[currentQ].correctIndex;

                      // FIX 4: Visual states
                      // - Default:  dark background, subtle border
                      // - Selected (correct):  green highlight
                      // - Selected (wrong):    amber highlight
                      // - Disabled (waiting):  reduced opacity
                      let bg = 'var(--bg-tertiary)';
                      let border = 'var(--border-default)';
                      let opacity = isAdvancing && !isSelected ? 0.5 : 1;

                      if (isSelected) {
                        bg = isCorrectAnswer
                          ? 'rgba(16, 185, 129, 0.18)'   // green tint
                          : 'rgba(245, 158, 11, 0.18)';  // amber tint
                        border = isCorrectAnswer
                          ? 'var(--success)'
                          : 'var(--warning, var(--accent-amber, #f59e0b))';
                      }

                      return (
                        <button
                          key={i}
                          onClick={() => handleAnswer(i)}
                          disabled={isAdvancing}
                          style={{
                            padding: 'var(--sp-4)',
                            background: bg,
                            border: `2px solid ${border}`,
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-primary)',
                            textAlign: 'left',
                            fontSize: 'var(--fs-md)',
                            cursor: isAdvancing ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex',
                            gap: 'var(--sp-4)',
                            alignItems: 'center',
                            opacity,
                          }}
                          onMouseEnter={e => {
                            if (!isAdvancing && !isSelected) {
                              e.currentTarget.style.background = 'var(--bg-hover)';
                              e.currentTarget.style.borderColor = 'var(--accent-purple)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isAdvancing && !isSelected) {
                              e.currentTarget.style.background = 'var(--bg-tertiary)';
                              e.currentTarget.style.borderColor = 'var(--border-default)';
                            }
                          }}
                        >
                          {/* FIX 4: Show checkmark icon on the selected answer */}
                          {isSelected ? (
                            <CheckCircle
                              size={16}
                              style={{
                                color: isCorrectAnswer ? 'var(--success)' : 'var(--warning, #f59e0b)',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold', flexShrink: 0 }}>
                              {String.fromCharCode(65 + i)}.
                            </span>
                          )}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Stream ended but no questions were generated */
                <div style={{ textAlign: 'center' }}>
                  Failed to load quiz.{' '}
                  <Button onClick={() => setStep(5)}>Skip Calibration</Button>
                </div>
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

                <Button size="lg" onClick={() => router.push('/cognition?magic=true')} style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', color: 'black', padding: '20px 40px', fontSize: 'var(--fs-lg)', fontWeight: 900, boxShadow: '0 10px 30px rgba(0, 240, 255, 0.3)' }}>
                  See Your Knowledge Graph <ArrowRight size={24} style={{ marginLeft: 8 }} />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
