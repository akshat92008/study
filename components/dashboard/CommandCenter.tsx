// components/dashboard/CommandCenter.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { useRouter } from 'next/navigation';
import { 
  Brain, Target, RefreshCw, Flame, ArrowRight, CheckCircle2, Clock, Send, MessageCircle, 
  Loader2, Paperclip, UploadCloud, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DailySessionFocus from './DailySessionFocus';
import { submitReview } from '@/lib/actions/revision';
import { useAppStore } from '@/stores/appStore';

interface Message {
  id?: string;
  role: 'user' | 'tutor' | 'system';
  content: string;
  type?: 'text' | 'flashcard_review' | 'upload_status';
  meta?: any;
}

export default function CommandCenter({ profile, cognition, revision, mistakes, tasks, onRefresh }: any) {
  const router = useRouter();
  const {
    currentActiveTask, setCurrentActiveTask, activeTasksList, setActiveTasksList,
    emotionalState, setEmotionalState, atlasMastery, setAtlasMastery,
    memoryDueCount, setMemoryDueCount, autopsyLossPoints, setAutopsyLossPoints, addToast
  } = useAppStore();

  useEffect(() => {
    if (tasks) {
      setActiveTasksList(tasks);
      const active = tasks.find((t: any) => !t.is_completed && (t.type === 'study' || t.type === 'revision'))
        || tasks.find((t: any) => !t.is_completed);
      setCurrentActiveTask(active || null);
    }
  }, [tasks, setActiveTasksList, setCurrentActiveTask]);

  useEffect(() => { if (profile?.emotional_state) setEmotionalState(profile.emotional_state); }, [profile]);
  useEffect(() => { if (cognition?.stats?.overallMastery !== undefined) setAtlasMastery(cognition.stats.overallMastery); }, [cognition]);
  useEffect(() => { if (revision?.stats?.due !== undefined) setMemoryDueCount(revision.stats.due); }, [revision]);
  useEffect(() => { if (mistakes?.totalMarksLost !== undefined) setAutopsyLossPoints(mistakes.totalMarksLost); }, [mistakes]);

  const [activeSession, setActiveSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'tutor', content: "Welcome to Cognition OS. What are we destroying today?", type: 'text'
  }]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'mock_test' | 'study_material'>('study_material');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const activeSessionTask = currentActiveTask || activeTasksList.find((t: any) => !t.is_completed);

  const handleSend = async () => {
    if (!chatInput.trim() || streaming) return;
    const textToSend = chatInput.trim();
    setChatInput('');
    
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
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let chunkContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          chunkContent += chunk;
          
          const parts = chunkContent.split('\n\n===METADATA===\n');
          const visibleText = parts[0];

          setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, content: visibleText } : m));
        }

        const parts = chunkContent.split('\n\n===METADATA===\n');
        if (parts.length > 1) {
          try {
            const meta = JSON.parse(parts[1]);
            if (meta.action === 'sprint_plan_created') {
              setActiveTasksList(meta.tasks);
              addToast("Sprint plan generated and synced!", "success");
            } else if (meta.action) {
              // Handle routing actions dynamically triggered by AI
              const routes: Record<string, string> = { show_analytics: '/analytics', show_atlas: '/knowledge', run_autopsy: '/autopsy', generate_flashcards: '/revision' };
              if (routes[meta.action]) {
                setTimeout(() => router.push(routes[meta.action]), 1500);
              }
            }
          } catch (err) {}
        }
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === tutorMsgId ? { ...m, content: 'An error occurred. Try again.' } : m));
    } finally {
      setStreaming(false);
      if (onRefresh) onRefresh();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    const fileMsgId = Math.random().toString(36).substring(7);
    setMessages(prev => [...prev, { id: fileMsgId, role: 'tutor', content: `Ingesting ${file.name} to neural core...`, type: 'upload_status', meta: { filename: file.name } }]);

    const formData = new FormData();
    formData.append('file', file);
    const apiRoute = uploadType === 'mock_test' ? '/api/autopsy/ingest' : '/api/ingest';

    try {
      const res = await fetch(apiRoute, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => prev.map(m => m.id === fileMsgId ? { ...m, content: `❌ Upload Failed: ${data.error}`, type: 'text' } : m));
      } else {
        const textContent = uploadType === 'mock_test' 
          ? `📊 Autopsy Complete. Total Marks Lost: **${data.autopsy?.marks_lost || 0}**. Sprint Scheduled.`
          : `📚 Syllabus Ingested: **${file.name}**. Injected into your ATLAS vector memory.`;
        setMessages(prev => prev.map(m => m.id === fileMsgId ? { ...m, content: textContent, type: 'text' } : m));
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === fileMsgId ? { ...m, content: `❌ Connection error.`, type: 'text' } : m));
    } finally {
      setUploadLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', height: '100%' }}>
      {activeSession && (
        <DailySessionFocus
          taskId={activeSession.id} subject={activeSession.subject || 'General'} chapter={activeSession.chapter || 'Focus'}
          estimatedMinutes={activeSession.estimated_minutes || 25} initialStreak={profile?.streak_days || 0}
          onClose={() => setActiveSession(null)}
          onCompleted={() => { setActiveSession(null); if (onRefresh) onRefresh(); }}
        />
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--sp-6)',
        height: 'calc(100vh - var(--header-height) - var(--sp-12))', overflow: 'hidden'
      }} className="responsive-workspace-grid">
        
        {/* LEFT PANE: One Dashboard Card & Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', paddingRight: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Command Center</h2>
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>Habit First, Intelligence Second</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(249, 115, 22, 0.12)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
              <Flame size={14} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-black)', color: 'var(--warning)' }}>{profile?.streak_days || 0}D</span>
            </div>
          </div>

          {/* THE "ONE CARD" APPROACH */}
          {activeSessionTask ? (
            <motion.div whileHover={{ y: -4 }} style={{ width: '100%' }}>
              <Card variant="glow" style={{
                background: 'linear-gradient(135deg, #111115, #0a0a0d)',
                border: '1px solid var(--accent-blue-dim)', padding: 'var(--sp-5)',
                display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
              }}>
                <Badge color="cyan">Today's Focus</Badge>
                <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)' }}>
                  {activeSessionTask.chapter || activeSessionTask.title}
                </h3>
                <p style={{ color: 'var(--accent-purple)', fontWeight: 600, fontSize: 'var(--fs-sm)', marginBottom: 8 }}>
                  {activeSessionTask.subject || 'General'} · {activeSessionTask.estimated_minutes || 25} mins
                </p>
                <button onClick={() => setActiveSession(activeSessionTask)} style={{
                  width: '100%', padding: '14px', background: 'linear-gradient(135deg, #0055ff, #00f0ff)',
                  color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  fontWeight: 700, fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
                }}>
                  Start Session <ArrowRight size={16} />
                </button>
              </Card>
            </motion.div>
          ) : (
            <Card style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid var(--success-dim)', padding: 'var(--sp-4)', textAlign: 'center' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--success)', margin: '0 auto' }} />
              <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', marginTop: 8 }}>Habit Locked In!</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: 2 }}>All tasks completed for today.</p>
            </Card>
          )}

          {/* Core Telemetry Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginTop: 'auto' }}>
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>MEMORY Due</span><RefreshCw size={12} style={{ color: memoryDueCount > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} /></div>
              <span style={{ fontSize: 'var(--sp-5)', fontWeight: 'var(--fw-black)', color: memoryDueCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{memoryDueCount || 0}</span>
            </Card>
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>ATLAS Mastery</span><Brain size={12} style={{ color: 'var(--accent-blue)' }} /></div>
              <span style={{ fontSize: 'var(--sp-5)', fontWeight: 'var(--fw-black)', color: 'var(--accent-blue)' }}>{atlasMastery || 0}%</span>
            </Card>
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>AUTOPSY Loss</span><Target size={12} style={{ color: 'var(--danger)' }} /></div>
              <span style={{ fontSize: 'var(--sp-5)', fontWeight: 'var(--fw-black)', color: 'var(--danger)' }}>-{autopsyLossPoints || 0}</span>
            </Card>
            <Card style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>PULSE State</span><Activity size={12} style={{ color: 'var(--text-primary)' }} /></div>
              <span style={{ fontSize: '13px', fontWeight: 'var(--fw-black)', color: emotionalState === 'burnt_out' ? 'var(--danger)' : 'var(--success)', textTransform: 'capitalize', marginTop: 2 }}>{emotionalState || 'Neutral'}</span>
            </Card>
          </div>
        </div>

        {/* RIGHT PANE: Unified Chat Orchestrator */}
        <div style={{
          display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden'
        }}>
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', background: 'var(--bg-primary)' }}>
            <MessageCircle size={18} style={{ color: 'var(--accent-cyan)', marginRight: 8 }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)' }}>Cognition OS Engine</span>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {messages.map((msg, i) => {
              const isTutor = msg.role === 'tutor' || msg.role === 'system';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isTutor ? 'flex-start' : 'flex-end', width: '100%' }}>
                  <div style={{
                    maxWidth: '85%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-lg)',
                    background: isTutor ? 'var(--bg-primary)' : 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)',
                    border: isTutor ? '1px solid var(--border-subtle)' : 'none', color: isTutor ? 'var(--text-primary)' : 'white',
                    fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)'
                  }}>
                    {msg.type === 'upload_status' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-xs)' }}>Compiling: {msg.meta?.filename}</span>
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content || (streaming && i === messages.length - 1 ? '●' : '')}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: 'var(--sp-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', position: 'relative' }}>
            <AnimatePresence>
              {showUploadMenu && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} style={{
                  position: 'absolute', bottom: 'calc(100% - 4px)', left: 'var(--sp-4)', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, width: '240px'
                }}>
                  <button onClick={() => { setUploadType('mock_test'); setShowUploadMenu(false); fileInputRef.current?.click(); }} style={{ padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block' }}>Upload Mock Test</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Extract marks lost and create revision sprints</span>
                  </button>
                  <button onClick={() => { setUploadType('study_material'); setShowUploadMenu(false); fileInputRef.current?.click(); }} style={{ padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', display: 'block' }}>Upload Syllabus/Material</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>Index documents to your ATLAS vector database</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".pdf,.txt,.md,image/*" />

            <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
              <button onClick={() => setShowUploadMenu(!showUploadMenu)} disabled={uploadLoading} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-full)', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}>
                {uploadLoading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </button>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Talk to Cognition OS..." disabled={streaming || uploadLoading} style={{
                flex: 1, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', outline: 'none', fontSize: 'var(--fs-sm)'
              }} />
              <button onClick={handleSend} disabled={!chatInput.trim() || streaming || uploadLoading} style={{
                background: 'linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%)', border: 'none', color: 'white',
                borderRadius: 'var(--radius-full)', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
