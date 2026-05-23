// components/onboarding/WeakSpotCheck.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

/**
 * Props for the WeakSpotCheck component.
 * - `examType`: string describing the exam or subject, used to generate quiz questions.
 * - `onComplete`: callback invoked with the array of quiz results when the user finishes the 5‑question check.
 */
interface WeakSpotCheckProps {
  examType: string;
  onComplete: (results: Array<{ chapter: string; concept: string; isCorrect: boolean }>) => void;
}

/**
 * A 5‑question inline quiz that runs after the user sets their exam type and deadline.
 * The component streams questions from `/api/onboarding/quiz` and tracks the user's
 * answers. Correct answers are marked as `exposed`, wrong answers as `not_started`
 * (the calling page can interpret the results to seed ATLAS state).
 */
export default function WeakSpotCheck({ examType, onComplete }: WeakSpotCheckProps) {
  const [quizData, setQuizData] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [quizResults, setQuizResults] = useState<Array<{ chapter: string; concept: string; isCorrect: boolean }>>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [quizStreaming, setQuizStreaming] = useState(false);
  const [calibrationStatus, setCalibrationStatus] = useState('Generating Calibration Check...');
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start streaming quiz questions when component mounts
  useEffect(() => {
    startQuiz();
    // Cleanup interval on unmount
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQuiz = async () => {
    setQuizData([]);
    setCurrentQ(0);
    setQuizResults([]);
    setSelectedAnswer(null);
    setIsAdvancing(false);
    setQuizStreaming(true);

    const statusMessages = [
      'Mapping your syllabus...',
      'Identifying the concepts that matter most...',
      'Generating Question 1...',
      'Generating Question 2...',
      'Generating Question 3...',
      'Generating Question 4...',
      'Generating Question 5...',
      'Finalising calibration...',
    ];
    let idx = 0;
    statusIntervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, statusMessages.length - 1);
      setCalibrationStatus(statusMessages[idx]);
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
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const question = JSON.parse(line);
            setQuizData(prev => [...prev, question]);
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (e) {
      console.error('Quiz stream error:', e);
    } finally {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      setQuizStreaming(false);
    }
  };

  const handleAnswer = (selectedIndex: number) => {
    if (isAdvancing) return;
    setSelectedAnswer(selectedIndex);
    setIsAdvancing(true);

    setTimeout(() => {
      const q = quizData[currentQ];
      const isCorrect = selectedIndex === q.correctIndex;
      const newResults = [...quizResults, { chapter: q.chapter, concept: q.concept, isCorrect }];
      setQuizResults(newResults);
      setSelectedAnswer(null);
      setIsAdvancing(false);

      if (currentQ < quizData.length - 1) {
        setCurrentQ(prev => prev + 1);
      } else {
        // Quiz finished – bubble results up to parent
        onComplete(newResults);
      }
    }, 500);
  };

  const firstQuestionReady = quizData.length > 0;
  const showCalibrationLoader = quizStreaming && !firstQuestionReady;

  return (
    <div style={{ width: '100%', maxWidth: 600 }}>
      <Card padding="lg" variant="glow" style={{ border: '1px solid var(--accent-purple-dim)', boxShadow: 'var(--shadow-glow-purple)' }}>
        {showCalibrationLoader ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
            <Loader2 size={48} className="animate-spin" style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-4)' }} />
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold' }}>Generating Calibration Check...</h2>
            <p style={{ color: 'var(--accent-purple)', fontSize: 'var(--fs-sm)', marginTop: 8, fontFamily: 'var(--font-mono)', transition: 'opacity 0.4s' }}>{calibrationStatus}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-2)' }}>
              Questions will appear as they're ready — you won't have to wait for all 5.
            </p>
          </div>
        ) : firstQuestionReady ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--sp-4)',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--fs-xs)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-wide)',
              }}
            >
              <span>Diagnostic Calibration</span>
              <span>{currentQ + 1} of {quizData.length}{quizStreaming ? '…' : ''}</span>
            </div>

            {/* Mini progress dots */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-6)' }}>
              {Array.from({ length: Math.max(quizData.length, 5) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background:
                      i < currentQ
                        ? 'var(--accent-purple)'
                        : i === currentQ
                        ? 'var(--accent-cyan)'
                        : i < quizData.length
                        ? 'var(--border-strong)'
                        : 'var(--bg-tertiary)',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>

            <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', lineHeight: 'var(--lh-relaxed)', marginBottom: 'var(--sp-8)' }}>
              {quizData[currentQ].question}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {quizData[currentQ].options.map((opt: string, i: number) => {
                const isSelected = selectedAnswer === i;
                const isCorrectAnswer = i === quizData[currentQ].correctIndex;
                let bg = 'var(--bg-tertiary)';
                let border = 'var(--border-default)';
                const opacity = isAdvancing && !isSelected ? 0.5 : 1;

                if (isSelected) {
                  bg = isCorrectAnswer ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.18)';
                  border = isCorrectAnswer ? 'var(--success)' : 'var(--warning, var(--accent-amber, #f59e0b))';
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
                    {isSelected ? (
                      <CheckCircle
                        size={16}
                        style={{
                          color: isCorrectAnswer ? 'var(--success)' : 'var(--warning, #f59e0b)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold', flexShrink: 0 }}>{String.fromCharCode(65 + i)}.</span>
                    )}
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            Failed to load quiz. <Button onClick={startQuiz}>Retry</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
