'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Brain, Flame, Clock, Loader2, Sparkles, Maximize2, Minimize2, Trophy } from 'lucide-react';
import {
  normalizeSessionCardResponse,
  type ClientSessionCard,
  type SessionCardUiStatus,
} from '@/lib/dashboard/session-card-contract';
import { CheckCircle2, Circle, Activity } from 'lucide-react';

export default function CurrentTaskCard({
  goalId,
  onSessionComplete,
}: {
  goalId?: string;
  onSessionComplete?: () => void;
}) {
  const [data, setData] = useState<ClientSessionCard | null>(null);
  const [microtasks, setMicrotasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardStatus, setCardStatus] = useState<SessionCardUiStatus>('empty');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { addToast, addChatMessage } = useAppStore();
  const router = useRouter();

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Custom focus state enhancements
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [updatedStreak, setUpdatedStreak] = useState(0);
  const [sessionClosingMessage, setSessionClosingMessage] = useState<string | null>(null);
  const completionKeyRef = useRef<string | null>(null);

  // Quotes
  const STUDY_QUOTES = [
    "Deep work produces elite results. Keep your eyes on the target.",
    "Your focus determines your reality. One concept at a time.",
    "Great things are built in silence. Let your prep make the noise.",
    "Mastery is not an accident; it is the compound interest of consistency.",
    "Every practice question you solve is a mistake avoided on exam day.",
    "Stay in the zone. You are stronger than your distractions.",
    "Focus is a muscle. Today, you are making it stronger."
  ];
  const [currentQuoteIdx, setCurrentQuoteIdx] = useState(0);

  const fetchSessionCard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const query = goalId ? `?goalId=${encodeURIComponent(goalId)}` : '';
      const res = await fetch(`/api/dashboard/session-card${query}`);
      if (!res.ok) {
        const message = res.status === 401 ? 'Please sign in to load today\'s session.' : 'Unable to load today\'s session.';
        setData(null);
        setCardStatus('error');
        setErrorMessage(message);
        return;
      }
      const json = await res.json();
      const normalized = normalizeSessionCardResponse(json);
      setData(normalized.card);
      setCardStatus(normalized.status);
      setErrorMessage(normalized.errorMessage ?? null);

      if (normalized.card) {
        const tasksRes = await fetch(`/api/dashboard/microtasks${query}`);
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setMicrotasks(tasksData.tasks || []);
        }
      }
    } catch (e) {
      console.error('Failed to fetch daily session card', e);
      setData(null);
      setCardStatus('error');
      setErrorMessage('Unable to load today\'s session.');
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchSessionCard();
    
    const handleRefresh = () => {
      fetchSessionCard();
    };
    
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, [fetchSessionCard]);

  // Listen to start-focus-session events from other components (like checklist)
  useEffect(() => {
    const handleStartFocus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        const newCard: ClientSessionCard = {
          focusTopic: detail.chapter || detail.title,
          subject: detail.subject,
          estimatedMinutes: detail.estimatedMinutes,
          dayNumber: data?.dayNumber || 1,
          streakDays: data?.streakDays || 0,
          rationale: `Focus session triggered from your daily targets checklist.`,
          daysToExam: data?.daysToExam ?? null,
          overdueCards: data?.overdueCards ?? 0,
          masteryPercent: data?.masteryPercent ?? 0,
          taskId: detail.taskId
        };
        setData(newCard);
        setCardStatus('ready');
        setErrorMessage(null);

        const durationSeconds = (detail.estimatedMinutes || 45) * 60;
        const endTime = Date.now() + durationSeconds * 1000;
        localStorage.setItem(`focus_session_end_${detail.chapter || detail.title}`, String(endTime));
        setIsSessionActive(true);
        setTimeLeft(durationSeconds);
        setIsMinimized(false);
        setShowCelebration(false);
        setSessionClosingMessage(null);
        addToast(`Focus session started for ${detail.chapter || detail.title}!`, 'info');
      }
    };
    window.addEventListener('start-focus-session', handleStartFocus);
    return () => window.removeEventListener('start-focus-session', handleStartFocus);
  }, [addToast, data]);

  // Load active session from localStorage
  useEffect(() => {
    if (data?.focusTopic) {
      const cachedEnd = localStorage.getItem(`focus_session_end_${data.focusTopic}`);
      if (cachedEnd) {
        const remainingMs = Number(cachedEnd) - Date.now();
        if (remainingMs > 0) {
          setIsSessionActive(true);
          setTimeLeft(Math.floor(remainingMs / 1000));
        } else {
          localStorage.removeItem(`focus_session_end_${data.focusTopic}`);
        }
      }
    }
  }, [data]);

  // Rotate study quotes
  useEffect(() => {
    let interval: any;
    if (isSessionActive) {
      interval = setInterval(() => {
        setCurrentQuoteIdx(prev => (prev + 1) % STUDY_QUOTES.length);
      }, 25000);
    }
    return () => clearInterval(interval);
  }, [STUDY_QUOTES.length, isSessionActive]);

  const completeFocusSession = useCallback(async () => {
    if (!data) return;
    try {
      let taskId = data.taskId || null;
      if (!taskId) {
        // Find matching task inside study_tasks if possible to complete it
        const query = goalId ? `?goalId=${encodeURIComponent(goalId)}` : '';
        const resTasks = await fetch(`/api/dashboard${query}`);
        if (resTasks.ok) {
          const dashData = await resTasks.json();
          const matchingTask = dashData?.tasks?.find(
            (t: any) => t.title.toLowerCase().includes(data.focusTopic.toLowerCase()) || (t.chapter && t.chapter.toLowerCase().includes(data.focusTopic.toLowerCase()))
          );
          if (matchingTask) taskId = matchingTask.id;
        }
      }

      const res = await fetch('/api/dashboard/complete-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': completionKeyRef.current || `session-card:${taskId || data.focusTopic}:${new Date().toISOString().slice(0, 10)}`,
        },
        body: JSON.stringify({
          taskId,
          subject: data.subject,
          chapter: data.focusTopic,
          durationMinutes: data.estimatedMinutes,
          goalId: goalId ?? null,
        })
      });
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resJson?.message || 'Session completion failed.');
      }

      addToast(`Mission completed: ${data.focusTopic} saved.`, 'success');
      addChatMessage({
        role: 'assistant',
        content: `**Session Complete.** ${resJson.closingMessage || `You completed ${data.focusTopic} for ${data.estimatedMinutes} minutes. Your progress and review queue are updating from this session.`}`,
        timestamp: new Date().toISOString()
      });

      localStorage.removeItem(`focus_session_end_${data.focusTopic}`);
      setIsSessionActive(false);
      setTimeLeft(0);

      const nextStreak = resJson.streakDays || ((data.streakDays || 0) + 1);
      setSessionClosingMessage(resJson.closingMessage ?? null);
      setUpdatedStreak(nextStreak);
      setShowCelebration(true);
      setCardStatus('completed');
      completionKeyRef.current = null;
    } catch (e: any) {
      console.error('Failed to complete focus session', e);
      addToast(e?.message || 'Failed to complete focus session.', 'error');
    }
  }, [addChatMessage, addToast, data, goalId]);

  const isRepairCard = Boolean(
    data && (
      data.taskType === 'mistake_repair' ||
      data.priority === 'mistake_repair' ||
      data.taskType === 'retest' ||
      data.priority === 'retest' ||
      data.repairPhase
    )
  );
  const isDelayedRetest = data?.repairPhase === 'delayed_retest' || data?.taskType === 'retest' || data?.priority === 'retest';

  const submitRepairProof = useCallback(async (passed: boolean) => {
    if (!data?.targetMistakeId && !data?.targetRetestId) {
      await completeFocusSession();
      return;
    }

    try {
      const res = await fetch('/api/repair/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isDelayedRetest ? 'delayed' : 'immediate',
          mistakeId: data.targetMistakeId ?? null,
          retestId: data.targetRetestId ?? null,
          passed,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Repair update failed.');

      const message = json?.transition?.message || (passed ? 'Repair progress saved.' : 'Repair remains open.');
      addToast(message, passed ? 'success' : 'info');
      addChatMessage({
        role: 'assistant',
        content: `**Repair update.** ${message}`,
        timestamp: new Date().toISOString(),
      });
      localStorage.removeItem(`focus_session_end_${data.focusTopic}`);
      setIsSessionActive(false);
      setTimeLeft(0);
      setSessionClosingMessage(message);
      setShowCelebration(passed);
      setCardStatus(passed ? 'completed' : 'ready');
      window.dispatchEvent(new Event('refresh-dashboard'));
    } catch (e: any) {
      addToast(e?.message || 'Failed to save repair progress.', 'error');
    }
  }, [addChatMessage, addToast, completeFocusSession, data, isDelayedRetest]);

  // Countdown timer logic
  useEffect(() => {
    let timer: any;
    if (isSessionActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSessionActive, timeLeft]);

  const startFocusSession = async () => {
    if (!data) return;
    if (isRepairCard && data.targetMistakeId) {
      await fetch('/api/repair/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mistakeId: data.targetMistakeId }),
      }).catch(() => undefined);
    }
    const durationSeconds = (data.estimatedMinutes || 45) * 60;
    const endTime = Date.now() + durationSeconds * 1000;
    completionKeyRef.current = `session-card:${data.taskId || data.focusTopic}:${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(`focus_session_end_${data.focusTopic}`, String(endTime));
    setIsSessionActive(true);
    setTimeLeft(durationSeconds);
    setIsMinimized(false);
    setShowCelebration(false);
    setSessionClosingMessage(null);
    addToast(`${isRepairCard ? 'Repair' : 'Focus'} session started for ${data.focusTopic}!`, 'info');
  };

  const cancelFocusSession = () => {
    if (!data) return;
    const confirm = window.confirm("Are you sure you want to end this study session early? Your progress won't be saved.");
    if (!confirm) return;

    localStorage.removeItem(`focus_session_end_${data.focusTopic}`);
    setIsSessionActive(false);
    setTimeLeft(0);
    setIsMinimized(false);
    addToast('Focus session cancelled.', 'info');
  };

  const closeCelebration = () => {
    setShowCelebration(false);
    setIsMinimized(false);
    if (onSessionComplete) {
      onSessionComplete();
    } else {
      window.location.reload();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-subtle)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '200px' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Finding the mark most at risk today.</span>
        </div>
      </Card>
    );
  }

  if (cardStatus === 'error') {
    return (
      <Card style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        padding: 'var(--sp-5)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        alignItems: 'center'
      }}>
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Session unavailable</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0, lineHeight: 1.5 }}>
          {errorMessage ?? 'Unable to load today\'s session.'}
        </p>
        <Button variant="secondary" onClick={fetchSessionCard}>Retry</Button>
      </Card>
    );
  }

  if (cardStatus === 'completed') {
    return (
      <Card style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--success-dim)',
        padding: 'var(--sp-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)'
      }}>
        <Badge color="green">{isRepairCard ? 'Repair Step Complete' : "Today's Session Complete"}</Badge>
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          {data?.focusTopic ?? 'Daily focus'}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0, lineHeight: 1.5 }}>
          {isRepairCard
            ? 'Repair progress is saved. The next plan adapts around any unresolved retest risk.'
            : 'Your streak and study profile are saved. The next mission can adapt from updated weak areas and revision signals.'}
        </p>
      </Card>
    );
  }

  if (!data) {
    const title = cardStatus === 'onboarding' ? 'Start by giving Cognition OS something to protect' : 'No repair risk yet';
    const description = cardStatus === 'onboarding'
      ? 'Paste wrong answers, upload mistakes, or take a diagnostic quiz so the first session can protect marks you are likely to lose again.'
      : 'Upload wrong answers or paste a mistake to create the first repair session.';
    return (
      <Card style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-subtle)', 
        padding: 'var(--sp-5)', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        alignItems: 'center'
      }}>
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', justifyContent: 'center' }}>
          <Button onClick={() => router.push('/autopsy/deep')}>Upload mistakes</Button>
          <Button variant="secondary" onClick={() => router.push('/chat')}>Take diagnostic quiz</Button>
        </div>
      </Card>
    );
  }

  const totalDuration = (data.estimatedMinutes || 45) * 60;
  const progressPercent = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      
      {/* 1. DISTRACTION-FREE FULL SCREEN OVERLAY */}
      {isSessionActive && !isMinimized && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(225deg, #040406 0%, #0c0a15 50%, #05060a 100%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sp-8)',
          color: 'var(--text-primary)',
          overflow: 'hidden'
        }}>
          {/* Minimize / Escape button */}
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              position: 'absolute', top: 'var(--sp-5)', right: 'var(--sp-5)',
              background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)', cursor: 'pointer',
              padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)',
              fontWeight: 'bold', transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
          >
            <Minimize2 size={12} /> Minimize Mode
          </button>

          {/* Core Content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-6)', textAlign: 'center', zIndex: 1, maxWidth: '500px' }}>
            
            {/* Header Labels */}
            <div>
              <Badge color="blue">{isRepairCard ? (isDelayedRetest ? 'Delayed Retest' : 'Repair Session') : 'Deep Focus Session'}</Badge>
              <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 900, marginTop: 'var(--sp-3)', color: 'var(--text-primary)' }}>
                {data.focusTopic}
              </h1>
              <p style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontSize: 'var(--fs-base)', marginTop: 4 }}>
                {data.subject} · {data.estimatedMinutes || 45} mins block
              </p>
            </div>

            {/* Circular Timer Visual */}
            <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="110" cy="110" r={radius} stroke="rgba(255, 255, 255, 0.03)" strokeWidth="6" fill="transparent" />
                <circle cx="110" cy="110" r={radius} stroke="var(--accent-blue)" strokeWidth="6" fill="transparent"
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                  style={{ strokeLinecap: 'round', transition: 'stroke-dashoffset 0.5s ease' }} />
              </svg>
              {/* Floating Digital readout inside circle */}
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: 'white', letterSpacing: 0 }}>
                  {formatTime(timeLeft)}
                </span>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.1em', marginTop: -2 }}>
                  remaining
                </span>
              </div>
            </div>

            {/* Motivational Study Quote */}
            <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontStyle: 'italic', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                " {STUDY_QUOTES[currentQuoteIdx]} "
              </p>
            </div>

            {/* Natural Beats Player */}
            <div style={{ width: '100%', maxWidth: '360px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', marginTop: 'var(--sp-2)', display: 'flex', justifyContent: 'center' }}>
              <audio controls loop style={{ height: '40px', width: '100%' }}>
                <source src="https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3" type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>

            {/* Control Actions */}
            <div style={{ display: 'flex', gap: 'var(--sp-3)', width: '100%', marginTop: 'var(--sp-2)' }}>
              <Button
                onClick={() => isRepairCard ? submitRepairProof(true) : completeFocusSession()}
                style={{
                  flex: 1.5, background: 'var(--success)', color: 'white', fontWeight: 'bold',
                  padding: '12px 0', fontSize: 'var(--fs-sm)', borderRadius: '6px',
                  boxShadow: 'var(--shadow-glow-success)'
                }}
              >
                {isRepairCard ? (isDelayedRetest ? 'Passed Retest' : 'Passed Immediate Recall') : 'Complete Study Session'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => isRepairCard ? submitRepairProof(false) : cancelFocusSession()}
                style={{
                  flex: 1, fontWeight: 'bold', padding: '12px 0', fontSize: 'var(--fs-sm)', borderRadius: '6px'
                }}
              >
                {isRepairCard ? (isDelayedRetest ? 'Failed Retest' : 'Still Stuck') : 'Give Up'}
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* 2. PERSISTENT FLOATING BANNER (WHEN MINIMIZED) */}
      {isSessionActive && isMinimized && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(90deg, #10121e, #0a0a0e)',
          borderBottom: '1px solid var(--accent-blue-dim)',
          padding: 'var(--sp-2) var(--sp-4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 9999,
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeIn var(--duration-normal) var(--ease-out) both'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span className="animate-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', boxShadow: '0 0 8px var(--warning)' }} />
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              Active Focus: <span style={{ color: 'var(--text-primary)' }}>{data.focusTopic}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: 'white' }}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <Button size="sm" onClick={() => setIsMinimized(false)} style={{ background: 'var(--accent-blue)', color: 'white', fontWeight: 'bold' }}>
              <Maximize2 size={10} style={{ marginRight: 4 }} /> Maximize
            </Button>
            <Button size="sm" onClick={completeFocusSession} style={{ background: 'var(--success)', color: 'white', fontWeight: 'bold' }}>
              Complete
            </Button>
          </div>
        </div>
      )}

      {/* 3. CELEBRATION MODAL OVERLAY */}
      {showCelebration && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 5, 8, 0.98)',
          backdropFilter: 'blur(20px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sp-4)',
          animation: 'fadeIn var(--duration-normal) var(--ease-out) both'
        }}>
          <Card variant="glow" style={{
            maxWidth: 480, width: '100%', padding: 'var(--sp-8)',
            background: 'var(--bg-secondary)', border: '1px solid var(--success-dim)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)'
          }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 76, height: 76, borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.08)', color: 'var(--success)',
                marginBottom: 'var(--sp-4)', boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
                position: 'relative'
              }}>
                <Trophy size={36} />
                <div style={{ position: 'absolute', top: -4, right: -4 }}>
                  <Sparkles size={16} style={{ color: 'var(--warning)' }} />
                </div>
              </div>
              <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--success)' }}>
                {isRepairCard ? 'Repair Step Complete!' : 'Focus Session Complete!'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 8, lineHeight: 1.4 }}>
                {isRepairCard
                  ? <>You saved repair progress for <strong style={{ color: 'var(--text-primary)' }}>{data.focusTopic}</strong>.</>
                  : <>You successfully completed your study block and revised <strong style={{ color: 'var(--text-primary)' }}>{data.focusTopic}</strong>.</>}
              </p>
              {sessionClosingMessage && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 14, lineHeight: 1.55, textAlign: 'left', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)' }}>
                  {sessionClosingMessage}
                </p>
              )}
            </div>

            <div style={{
              background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
              padding: 'var(--sp-5)', border: '1px solid var(--border-default)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Flame size={28} className="animate-pulse" style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)' }}>
                  {data.streakDays || 0} → {updatedStreak} Days
                </span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                🔥 Streak updated in profiles database.
              </div>
            </div>

            <Button onClick={closeCelebration} style={{ background: 'var(--success)', color: '#fff', width: '100%', fontWeight: 600 }}>
              Return to Dashboard
            </Button>
          </Card>
        </div>
      )}

      {/* 4. STANDARD DASHBOARD TASK CARD */}
      <Card variant="glow" style={{
        background: 'linear-gradient(135deg, #111115, #0a0a0d)',
        border: isSessionActive ? '1px solid var(--warning-dim)' : '1px solid var(--accent-blue-dim)', 
        padding: 'var(--sp-5)',
        display: 'flex', 
        flexDirection: 'column', 
        gap: 'var(--sp-3)', 
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={12} style={{ color: 'var(--warning)' }} />
            DAY {data.dayNumber || 1} · {data.streakDays || 0}D STREAK
          </span>
          <Badge color={isSessionActive ? 'yellow' : 'cyan'}>
            {isSessionActive ? (isRepairCard ? 'Repair Active' : 'Mission Active') : (isRepairCard ? (isDelayedRetest ? 'Retest Due' : "Today's Repair") : "Today's Mission")}
          </Badge>
        </div>
        
        <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)' }}>
          {data.focusTopic}
        </h3>
        
        <p style={{ color: 'var(--accent-purple)', fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Brain size={14} style={{ color: 'var(--accent-purple)' }} />
          {data.subject} 
          <span style={{ color: 'var(--text-tertiary)' }}>·</span> 
          <Clock size={14} style={{ color: 'var(--text-secondary)' }} /> {data.estimatedMinutes || 45} mins
          {data.overdueCards !== undefined && data.overdueCards > 0 && (
            <>
              <span style={{ color: 'var(--text-tertiary)' }}>·</span> 
              <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Activity size={14} /> {data.overdueCards} cards due
              </span>
            </>
          )}
        </p>
        
        {data.rationale && (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid rgba(255, 255, 255, 0.05)', 
            borderRadius: 8, 
            padding: 12, 
            marginBottom: 12, 
            fontSize: '11px', 
            color: 'var(--text-secondary)',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6
          }}>
            <Sparkles size={12} style={{ color: 'var(--accent-cyan)', marginTop: 2, flexShrink: 0 }} />
            <span><strong style={{ color: 'var(--text-primary)' }}>{isRepairCard ? 'Why now:' : 'Why this mission:'}</strong> {data.rationale}</span>
          </div>
        )}

        {microtasks.length > 0 && !isSessionActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
            {microtasks.map((task) => (
              <div key={task.id} style={{ 
                display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', 
                background: 'rgba(255,255,255,0.03)', padding: 'var(--sp-2) var(--sp-3)', 
                borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <button 
                  onClick={async () => {
                    const newStatus = task.status === 'done' ? 'pending' : 'done';
                    setMicrotasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
                    await fetch('/api/dashboard/microtasks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'update_status', id: task.id, status: newStatus, goalId: goalId ?? null })
                    });
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {task.status === 'done' ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : <Circle size={16} style={{ color: 'var(--text-tertiary)' }} />}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: task.status === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                    {task.title}
                  </span>
                  {(task.subject || task.estimated_minutes) && (
                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {[task.subject, `${task.estimated_minutes}m`].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--sp-3)' }}>
          {!isSessionActive ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              <Button
                onClick={startFocusSession}
                style={{
                  background: isRepairCard ? 'var(--danger)' : 'var(--accent-blue)',
                  color: 'white',
                  fontWeight: 'bold',
                  width: 'fit-content',
                  fontSize: 'var(--fs-sm)',
                  padding: '8px 16px',
                  borderRadius: '6px'
                }}
              >
                {isRepairCard ? (isDelayedRetest ? 'Start retest' : 'Start repair') : 'Start Focus Session'}
              </Button>
              {isRepairCard && (
                <Button variant="secondary" onClick={() => router.push('/autopsy/deep')}>
                  Upload mistakes
                </Button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', color: 'var(--warning)', fontWeight: 'bold' }}>
                <span className="animate-pulse" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', boxShadow: '0 0 8px var(--warning)' }} />
                <span>Focus Active: <span style={{ fontFamily: 'monospace', color: 'white', fontSize: 'var(--fs-base)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{formatTime(timeLeft)}</span> remaining</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <Button
                  onClick={() => setIsMinimized(false)}
                  style={{
                    background: 'var(--accent-blue)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 'var(--fs-xs)',
                    padding: '6px 12px',
                    borderRadius: '4px'
                  }}
                >
                  <Maximize2 size={10} style={{ marginRight: 4 }} /> Maximize Focus
                </Button>
                <Button
                  onClick={() => isRepairCard ? submitRepairProof(true) : completeFocusSession()}
                  style={{
                    background: 'var(--success)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 'var(--fs-xs)',
                    padding: '6px 12px',
                    borderRadius: '4px'
                  }}
                >
                  {isRepairCard ? (isDelayedRetest ? 'Passed Retest' : 'Passed Recall') : 'Complete Session'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => isRepairCard ? submitRepairProof(false) : cancelFocusSession()}
                  style={{
                    fontWeight: 'bold',
                    fontSize: 'var(--fs-xs)',
                    padding: '6px 12px',
                    borderRadius: '4px'
                  }}
                >
                  {isRepairCard ? (isDelayedRetest ? 'Failed Retest' : 'Still Stuck') : 'Cancel'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
