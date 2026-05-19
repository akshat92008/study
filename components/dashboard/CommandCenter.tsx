'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import Link from 'next/link';
import {
  Brain, Target, RefreshCw, Calendar, BarChart3, Zap,
  Flame, ArrowRight, CheckCircle2, Clock, Send, MessageCircle,
  Loader2, BookOpen, Activity, Paperclip, UploadCloud, ChevronRight, Check, X, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DailySessionFocus from './DailySessionFocus';
import { submitReview } from '@/lib/actions/revision';
import { useAppStore } from '@/stores/appStore';

interface Props {
  profile: any;
  cognition: any;
  revision: any;
  mistakes: any;
  tasks: any[];
  onRefresh?: () => void;
}

interface Message {
  id?: string;
  role: 'user' | 'tutor' | 'system';
  content: string;
  type?: 'text' | 'flashcard_review' | 'upload_status';
  meta?: any;
}

export default function CommandCenter({ profile, cognition, revision, mistakes, tasks, onRefresh }: Props) {
  const stats = cognition?.stats || {};
  const revStats = revision?.stats || {};
  const mistakeData = mistakes || {};
  const today = new Date().toISOString().split('T')[0];

  const {
    currentActiveTask,
    setCurrentActiveTask,
    activeTasksList,
    setActiveTasksList,
    emotionalState,
    setEmotionalState,
    atlasMastery,
    setAtlasMastery,
    memoryDueCount,
    setMemoryDueCount,
    autopsyLossPoints,
    setAutopsyLossPoints,
    addToast
  } = useAppStore();

  const [contextState, setContextState] = useState<any>({
    target_date: null,
    subjects: null,
    hours: null
  });

  // Synchronize incoming initial props to the Zustand store for reactive state changes
  useEffect(() => {
    if (tasks) {
      setActiveTasksList(tasks);
      const active = tasks.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision'))
        || tasks.find((t: any) => !t.is_completed);
      setCurrentActiveTask(active || null);
    }
  }, [tasks, setActiveTasksList, setCurrentActiveTask]);

  useEffect(() => {
    if (profile?.emotional_state) {
      setEmotionalState(profile.emotional_state);
    }
  }, [profile?.emotional_state, setEmotionalState]);

  useEffect(() => {
    if (stats?.overallMastery !== undefined) {
      setAtlasMastery(stats.overallMastery);
    }
  }, [stats?.overallMastery, setAtlasMastery]);

  useEffect(() => {
    if (revStats?.due !== undefined) {
      setMemoryDueCount(revStats.due);
    }
  }, [revStats?.due, setMemoryDueCount]);

  useEffect(() => {
    if (mistakeData?.totalMarksLost !== undefined) {
      setAutopsyLossPoints(mistakeData.totalMarksLost);
    }
  }, [mistakeData?.totalMarksLost, setAutopsyLossPoints]);

  // Active Socratic Session overlay state
  const [activeSession, setActiveSession] = useState<any>(null);

  // Chat State with random ID
  const [messages, setMessages] = useState<Message[]>([
    {
      id: Math.random().toString(36).substring(7),
      role: 'tutor',
      content: "Welcome to your Command Center. Ask me a question about your syllabus, click 'Review Now' to clear your memory list, or drop a mock test to compile an Autopsy report.",
      type: 'text'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Selector mappings
  const concepts = cognition?.concepts || [];
  const subjectChapterMap: Record<string, string[]> = {};
  concepts.forEach((c: any) => {
    if (!subjectChapterMap[c.subject]) subjectChapterMap[c.subject] = [];
    if (!subjectChapterMap[c.subject].includes(c.chapter)) {
      subjectChapterMap[c.subject].push(c.chapter);
    }
  });

  const userSubjects = Object.keys(subjectChapterMap).length > 0 ? Object.keys(subjectChapterMap) : ['General'];
  const [subject, setSubject] = useState(userSubjects[0]);
  const [chapter, setChapter] = useState((subjectChapterMap[userSubjects[0]] || ['General'])[0]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'mock_test' | 'study_material'>('study_material');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync selectors if default values change
  useEffect(() => {
    if (userSubjects.length > 0 && !subject) {
      setSubject(userSubjects[0]);
      setChapter((subjectChapterMap[userSubjects[0]] || ['General'])[0]);
    }
  }, [concepts]);

  // Task filtering subscription (reactive)
  const activeSessionTask = currentActiveTask
    || activeTasksList.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision'))
    || activeTasksList.find((t: any) => !t.is_completed)
    || tasks.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision'))
    || tasks.find((t: any) => !t.is_completed);

  // Standard Socratic Tutor message delivery
  const handleSend = async (overrideMessage?: string) => {
    const textToSend = overrideMessage || chatInput.trim();
    if (!textToSend || streaming) return;

    if (!overrideMessage) setChatInput('');
    
    // Add user message
    const userMsgId = Math.random().toString(36).substring(7);
    const tutorMsgId = Math.random().toString(36).substring(7);

    setMessages(prev => [
      ...prev, 
      { id: userMsgId, role: 'user', content: textToSend },
      { id: tutorMsgId, role: 'tutor', content: '' }
    ]);
    setStreaming(true);

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          subject,
          chapter,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          contextState
        }),
      });

      if (res.status === 403) {
        const errData = await res.json();
        setMessages(prev => prev.map(m => m.id === tutorMsgId ? {
          ...m,
          role: 'tutor',
          content: `🚫 Limit Reached: ${errData.error || 'Upgrade required.'} Upgrade to Pro for unlimited tutor queries, documents, and autopsy reports.`
        } : m));
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let chunkContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          chunkContent += chunk;
          
          // Separate visible content from metadata payload
          const parts = chunkContent.split('\n\n===METADATA===\n');
          const visibleText = parts[0];

          setMessages(prev => prev.map(m => m.id === tutorMsgId ? {
            ...m,
            content: visibleText
          } : m));
        }

        // Parse suffix metadata if it was pushed
        const parts = chunkContent.split('\n\n===METADATA===\n');
        if (parts.length > 1) {
          try {
            const meta = JSON.parse(parts[1]);
            
            if (meta.action === 'sprint_plan_created') {
              setActiveTasksList(meta.tasks);
              const active = meta.tasks.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision'))
                || meta.tasks.find((t: any) => !t.is_completed);
              setCurrentActiveTask(active || null);
              addToast("Hyper-sprint plan generated and synced!", "success");
            }
            
            if (meta.contextState) {
              setContextState(meta.contextState);
            }
          } catch (err) {
            console.error("Failed to parse metadata payload", err);
          }
        }
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === tutorMsgId ? {
        ...m,
        content: 'An error occurred. Check connectivity and try again.'
      } : m));
    } finally {
      setStreaming(false);
      if (onRefresh) onRefresh();
    }
  };

  // Start FSRS Flashcard Review inside Chat
  const handleStartRevision = async () => {
    setStreaming(true);
    try {
      const res = await fetch('/api/revision');
      const d = await res.json();
      const cards = d.dueCards || [];

      if (cards.length === 0) {
        setMessages(prev => [...prev, {
          role: 'tutor',
          content: 'No flashcards are due for review right now! Feel free to ask a question or upload study materials to seed new concepts.'
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'tutor',
          content: `You have ${cards.length} cards due. Let's clear them.`,
          type: 'flashcard_review',
          meta: {
            cards,
            currentIndex: 0,
            showAnswer: false
          }
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'tutor',
        content: 'Failed to load due flashcards. Please try again.'
      }]);
    } finally {
      setStreaming(false);
    }
  };

  // Handle flashcard rating button clicks
  const handleRateCard = async (messageIndex: number, rating: 1 | 2 | 3 | 4) => {
    const msg = messages[messageIndex];
    if (!msg || !msg.meta) return;

    const { cards, currentIndex } = msg.meta;
    const currentCard = cards[currentIndex];

    try {
      // Submit to FSRS engine
      await submitReview(currentCard.id, rating);

      // Advance state
      const nextIndex = currentIndex + 1;
      setMessages(prev => {
        const updated = [...prev];
        if (nextIndex >= cards.length) {
          updated[messageIndex] = {
            role: 'tutor',
            content: `🎉 Completed! Cleared ${cards.length} due memories. Your memory graphs are decay-adjusted.`,
            type: 'text'
          };
        } else {
          updated[messageIndex] = {
            ...msg,
            meta: {
              ...msg.meta,
              currentIndex: nextIndex,
              showAnswer: false
            }
          };
        }
        return updated;
      });

      // Refresh Stats UI
      if (onRefresh) onRefresh();
    } catch (e) {
      alert('Failed to submit card rating.');
    }
  };

  // Trigger file upload selection
  const triggerFileUpload = (type: 'mock_test' | 'study_material') => {
    setUploadType(type);
    setShowUploadMenu(false);
    fileInputRef.current?.click();
  };

  // Process File Uploads
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    const fileMsgId = Math.random().toString(36).substring(7);
    
    // Add pending status block
    setMessages(prev => [...prev, {
      id: fileMsgId,
      role: 'tutor',
      content: `Ingesting ${file.name} to neural core...`,
      type: 'upload_status',
      meta: { filename: file.name, status: 'uploading' }
    }]);

    const formData = new FormData();
    formData.append('file', file);

    const apiRoute = uploadType === 'mock_test' ? '/api/autopsy/ingest' : '/api/ingest';

    try {
      const res = await fetch(apiRoute, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.error || 'Unknown error occurred.';
        setMessages(prev => prev.map(m => m.id === fileMsgId ? {
          ...m,
          role: 'tutor',
          content: `❌ Upload Failed: ${errorMsg}`,
          type: 'text'
        } : m));
        addToast(`Upload failed: ${errorMsg}`, "error");
      } else {
        // Success
        let textContent = '';
        if (uploadType === 'mock_test') {
          textContent = `📊 Autopsy Complete for: ${data.autopsy?.test_name || file.name.replace(/\.[^/.]+$/, "")}
- Total Marks Lost: **${data.autopsy?.marks_lost || 0}**
- Extracted Gaps: ${data.autopsy?.gaps_detected?.length || 0} critical concept failures found.
- Sprint Scheduled: Mistake profiles seeded into your FSRS review queue.`;
          
          if (data.autopsy?.marks_lost !== undefined) {
            setAutopsyLossPoints(autopsyLossPoints + data.autopsy.marks_lost);
          }
        } else {
          textContent = `📚 Syllabus Ingested: **${file.name}** successfully parsed. Concept nodes mapped and injected into your personal ATLAS vector memory.`;
        }

        setMessages(prev => prev.map(m => m.id === fileMsgId ? {
          ...m,
          role: 'tutor',
          content: textContent,
          type: 'text'
        } : m));
        addToast("Ingestion completed successfully!", "success");
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === fileMsgId ? {
        ...m,
        role: 'tutor',
        content: `❌ Connection error during ingestion. Please check file format and try again.`,
        type: 'text'
      } : m));
      addToast("Connection error during ingestion.", "error");
    } finally {
      setUploadLoading(false);
      if (e.target) e.target.value = ''; // Reset input
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', height: '100%' }}>
      {/* Socratic Session Overlay */}
      {activeSession && (
        <DailySessionFocus
          taskId={activeSession.id}
          subject={activeSession.subject || 'General'}
          chapter={activeSession.chapter || 'Study Focus'}
          estimatedMinutes={activeSession.estimated_minutes || 25}
          initialStreak={profile?.streak_days || 0}
          onClose={() => setActiveSession(null)}
          onCompleted={() => {
            setActiveSession(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Main Grid: Left Stats Pane & Right Chat Pane */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 'var(--sp-6)',
        height: 'calc(100vh - var(--header-height) - var(--sp-12))',
        minHeight: '500px',
        overflow: 'hidden'
      }} className="responsive-workspace-grid">
        
        {/* LEFT COLUMN: Stats & Daily Focus */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {/* Header Greeting */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Command Center</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>Habit First, Intelligence Second</p>
            </div>
            {/* Streak Flame */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
              background: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.25)',
              padding: '4px 10px', borderRadius: 'var(--radius-full)'
            }}>
              <Flame size={14} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-black)', color: 'var(--warning)' }}>
                {profile?.streak_days || 0}D
              </span>
            </div>
          </div>

          {/* Today's Focus Card */}
          {activeSessionTask ? (
            <Card variant="glow" style={{
              background: 'linear-gradient(135deg, rgba(20, 24, 33, 0.6) 0%, rgba(10, 12, 18, 0.8) 100%)',
              border: '1px solid var(--accent-blue-dim)',
              padding: 'var(--sp-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-3)',
              boxShadow: 'var(--shadow-glow-blue-dim)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Badge color="cyan">Today's Focus</Badge>
                  <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 4 }}>
                    {activeSessionTask.chapter || activeSessionTask.title}
                  </h3>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <BookOpen size={10} style={{ color: 'var(--accent-cyan)' }} />
                    {activeSessionTask.subject || 'General'}
                    <span>•</span>
                    <Clock size={10} style={{ color: 'var(--success)' }} />
                    {activeSessionTask.estimated_minutes || 25}m
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveSession(activeSessionTask)}
                style={{
                  width: '100%',
                  padding: 'var(--sp-2) 0',
                  background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 'var(--fs-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--sp-1)',
                  boxShadow: 'var(--shadow-glow-blue)',
                  transition: 'transform var(--duration-fast) var(--ease-out)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Start Session <ArrowRight size={14} />
              </button>
            </Card>
          ) : (
            <Card style={{
              background: 'rgba(34, 197, 94, 0.05)',
              border: '1px solid var(--success-dim)',
              padding: 'var(--sp-4)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--sp-2)'
            }}>
              <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
              <div>
                <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)' }}>Habit Locked In!</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                  All tasks completed for today.
                </p>
              </div>
            </Card>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            
            {/* MEMORY DUE */}
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>MEMORY Due</span>
                <RefreshCw size={12} style={{ color: memoryDueCount > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} />
              </div>
              <span style={{ fontSize: 'var(--sp-5)', fontWeight: 'var(--fw-black)', color: memoryDueCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {memoryDueCount || 0}
              </span>
              {memoryDueCount > 0 && (
                <button
                  onClick={handleStartRevision}
                  style={{
                    background: 'var(--warning-dim)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--warning)',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                    marginTop: 2
                  }}
                >
                  Review Now
                </button>
              )}
            </Card>

            {/* ATLAS MASTERY */}
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>ATLAS Mastery</span>
                <Brain size={12} style={{ color: 'var(--accent-blue)' }} />
              </div>
              <span style={{ fontSize: 'var(--sp-5)', fontWeight: 'var(--fw-black)', color: 'var(--accent-blue)' }}>
                {atlasMastery || 0}%
              </span>
              <div style={{ marginTop: 6 }}>
                <Progress value={atlasMastery || 0} color="blue" size="sm" />
              </div>
            </Card>

            {/* AUTOPSY LOSS */}
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>AUTOPSY Loss</span>
                <Target size={12} style={{ color: 'var(--danger)' }} />
              </div>
              <span style={{ fontSize: 'var(--sp-5)', fontWeight: 'var(--fw-black)', color: 'var(--danger)' }}>
                -{autopsyLossPoints || 0}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Points deducted</span>
            </Card>

            {/* PULSE STATE */}
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>PULSE State</span>
                <Activity size={12} style={{ color: emotionalState === 'burnt_out' ? 'var(--danger)' : 'var(--text-primary)' }} />
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 'var(--fw-black)',
                color: emotionalState === 'burnt_out' ? 'var(--danger)' : 'var(--success)',
                textTransform: 'capitalize',
                marginTop: 2
              }}>
                {emotionalState || 'Neutral'}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Decay weights: active</span>
            </Card>

          </div>

          {/* Neural compiler dropzone widget */}
          <Card style={{
            padding: 'var(--sp-4)',
            border: '1px dashed var(--border-default)',
            background: 'rgba(255, 255, 255, 0.01)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 'var(--sp-2)',
            marginTop: 'auto'
          }}>
            <UploadCloud size={24} style={{ color: 'var(--text-tertiary)' }} />
            <div>
              <h4 style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)' }}>Neural Core Compiler</h4>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '9px', marginTop: 2 }}>
                Upload mock test or syllabus notes directly
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
              <button
                onClick={() => triggerFileUpload('mock_test')}
                style={{
                  flex: 1, padding: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                  borderRadius: 4, fontSize: '9px', cursor: 'pointer', color: 'var(--text-secondary)'
                }}
              >
                Mock Test
              </button>
              <button
                onClick={() => triggerFileUpload('study_material')}
                style={{
                  flex: 1, padding: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                  borderRadius: 4, fontSize: '9px', cursor: 'pointer', color: 'var(--text-secondary)'
                }}
              >
                Study Material
              </button>
            </div>
          </Card>

        </div>

        {/* RIGHT COLUMN: Socratic Tutor Chat Workspace */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}>
          {/* Chat Workspace Header */}
          <div style={{
            padding: 'var(--sp-3) var(--sp-4)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <MessageCircle size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)' }}>Socratic Assistant</span>
            </div>
            
            {/* Subject/Chapter Selectors */}
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <select
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  setChapter((subjectChapterMap[e.target.value] || ['General'])[0]);
                }}
                style={{
                  padding: '2px 8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '11px', outline: 'none'
                }}
              >
                {userSubjects.map(s => <option key={s}>{s}</option>)}
              </select>
              <select
                value={chapter}
                onChange={e => setChapter(e.target.value)}
                style={{
                  padding: '2px 8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '11px', outline: 'none',
                  maxWidth: '150px'
                }}
              >
                {(subjectChapterMap[subject] || []).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--sp-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-4)'
          }}>
            {messages.map((msg, i) => {
              const isTutor = msg.role === 'tutor' || msg.role === 'system';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: isTutor ? 'flex-start' : 'flex-end',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: 'var(--sp-3) var(--sp-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: isTutor ? 'var(--bg-primary)' : 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                      border: isTutor ? '1px solid var(--border-subtle)' : 'none',
                      color: isTutor ? 'var(--text-primary)' : 'white',
                      boxShadow: isTutor ? 'none' : 'var(--shadow-glow-blue-dim)',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: 'var(--lh-relaxed)'
                    }}
                  >
                    {/* Generative UI Option 1: FSRS Flashcard Review */}
                    {msg.type === 'flashcard_review' && msg.meta ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', minWidth: '260px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                            Memory Review ({msg.meta.currentIndex + 1} of {msg.meta.cards.length})
                          </span>
                          <span style={{ fontSize: '9px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-cyan)' }}>
                            {msg.meta.cards[msg.meta.currentIndex].subject}
                          </span>
                        </div>

                        {/* Card Contents */}
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: 'var(--sp-4)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: '4px solid var(--accent-cyan)',
                          minHeight: '80px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          fontSize: 'var(--fs-base)',
                          fontWeight: 500
                        }}>
                          {msg.meta.cards[msg.meta.currentIndex].front}
                        </div>

                        {/* Reveal answer button */}
                        {!msg.meta.showAnswer ? (
                          <button
                            onClick={() => {
                              setMessages(prev => {
                                const updated = [...prev];
                                updated[i] = { ...msg, meta: { ...msg.meta, showAnswer: true } };
                                return updated;
                              });
                            }}
                            style={{
                              width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
                              color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--fs-sm)'
                            }}
                          >
                            Reveal Answer
                          </button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
                          >
                            {/* Card Answer Back */}
                            <div style={{
                              background: 'rgba(34, 197, 94, 0.05)',
                              border: '1px solid var(--success-dim)',
                              padding: 'var(--sp-4)',
                              borderRadius: 'var(--radius-md)',
                              color: 'var(--text-primary)',
                              fontSize: 'var(--fs-sm)',
                              textAlign: 'center',
                              lineHeight: 'var(--lh-relaxed)'
                            }}>
                              {msg.meta.cards[msg.meta.currentIndex].back}
                            </div>

                            {/* FSRS rating buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                              <button
                                onClick={() => handleRateCard(i, 1)}
                                style={{
                                  padding: '6px 0', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#ef4444', borderRadius: 4, fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                                }}
                              >
                                Again
                              </button>
                              <button
                                onClick={() => handleRateCard(i, 2)}
                                style={{
                                  padding: '6px 0', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
                                  color: '#f59e0b', borderRadius: 4, fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                                }}
                              >
                                Hard
                              </button>
                              <button
                                onClick={() => handleRateCard(i, 3)}
                                style={{
                                  padding: '6px 0', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)',
                                  color: '#38bdf8', borderRadius: 4, fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                                }}
                              >
                                Good
                              </button>
                              <button
                                onClick={() => handleRateCard(i, 4)}
                                style={{
                                  padding: '6px 0', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
                                  color: '#22c55e', borderRadius: 4, fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                                }}
                              >
                                Easy
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ) : msg.type === 'upload_status' && msg.meta ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: '220px' }}>
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-xs)' }}>Compiling to Neural Core</span>
                          <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{msg.meta.filename}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content || (streaming && i === messages.length - 1 ? '●' : '')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Workspace Input Footer */}
          <div style={{
            padding: 'var(--sp-4)',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-primary)',
            position: 'relative'
          }}>
            {/* Upload Menu Popover */}
            <AnimatePresence>
              {showUploadMenu && (
                <>
                  <div
                    onClick={() => setShowUploadMenu(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% - 4px)',
                      left: 'var(--sp-4)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      zIndex: 65,
                      width: '240px'
                    }}
                  >
                    <button
                      onClick={() => triggerFileUpload('mock_test')}
                      style={{
                        padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)',
                        textAlign: 'left', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex',
                        flexDirection: 'column', gap: 2
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold' }}>Upload Mock Test</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Extract marks lost and create revision sprints</span>
                    </button>
                    <button
                      onClick={() => triggerFileUpload('study_material')}
                      style={{
                        padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)',
                        textAlign: 'left', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex',
                        flexDirection: 'column', gap: 2
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold' }}>Upload Syllabus/Material</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Index documents to your ATLAS vector knowledge base</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept=".pdf,.txt,.md,image/*"
            />

            <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
              {/* Paperclip upload button */}
              <button
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                disabled={uploadLoading}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-full)',
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                {uploadLoading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </button>

              {/* Chat Input Text Field */}
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Ask Socratic assistant about ${chapter}...`}
                disabled={streaming || uploadLoading}
                style={{
                  flex: 1,
                  padding: 'var(--sp-3) var(--sp-4)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  outline: 'none',
                  fontSize: 'var(--fs-sm)'
                }}
              />

              {/* Send Button */}
              <button
                onClick={() => handleSend()}
                disabled={!chatInput.trim() || streaming || uploadLoading}
                style={{
                  background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                  border: 'none',
                  color: 'white',
                  borderRadius: 'var(--radius-full)',
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: 'var(--shadow-glow-blue)'
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
