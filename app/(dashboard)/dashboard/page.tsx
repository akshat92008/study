'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  Send, Paperclip, Loader2, Brain, RefreshCw, Target, Flame, ArrowRight,
  Upload, X, MessageSquare, Check, Activity, ChevronRight, Play, AlertTriangle, Sparkles, Crosshair
} from 'lucide-react';
import CognitionDashboard from '@/components/cognition/CognitionDashboard';
import RevisionQueue from '@/components/revision/RevisionQueue';
import AutopsyDashboard from '@/components/autopsy/AutopsyDashboard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Clean inline Markdown formatter
function renderMarkdown(text: string) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('```')) {
      const match = part.match(/```([a-zA-Z]*)\n?([\s\S]*?)```/);
      const code = match ? match[2] : part.slice(3, -3);
      return (
        <pre key={idx} style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-4)',
          margin: 'var(--sp-3) 0',
          overflowX: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-primary)'
        }}>
          <code>{code}</code>
        </pre>
      );
    }

    const lines = part.split('\n');
    return (
      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        {lines.map((line, lIdx) => {
          let content: React.ReactNode = line;

          if (line.includes('**')) {
            const boldParts = line.split(/(\*\*.*?\*\*)/g);
            content = boldParts.map((bp, bpIdx) => {
              if (bp.startsWith('**') && bp.endsWith('**')) {
                return <strong key={bpIdx} style={{ fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{bp.slice(2, -2)}</strong>;
              }
              return bp;
            });
          }

          if (line.trim().startsWith('- ')) {
            return (
              <li key={lIdx} style={{ marginLeft: 'var(--sp-4)', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
                {line.trim().substring(2)}
              </li>
            );
          }

          if (/^\d+\.\s/.test(line.trim())) {
            const numContent = line.trim().replace(/^\d+\.\s/, '');
            return (
              <li key={lIdx} style={{ marginLeft: 'var(--sp-4)', listStyleType: 'decimal', color: 'var(--text-secondary)' }}>
                {numContent}
              </li>
            );
          }

          if (line.trim().startsWith('### ')) {
            return <h4 key={lIdx} style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 'var(--sp-2)' }}>{line.trim().substring(4)}</h4>;
          }
          if (line.trim().startsWith('## ')) {
            return <h3 key={lIdx} style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 'var(--sp-3)' }}>{line.trim().substring(3)}</h3>;
          }
          if (line.trim().startsWith('# ')) {
            return <h2 key={lIdx} style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', marginTop: 'var(--sp-4)' }}>{line.trim().substring(2)}</h2>;
          }

          return (
            <p key={lIdx} style={{ margin: '2px 0', minHeight: line.trim() === '' ? '8px' : 'auto', color: 'var(--text-secondary)' }}>
              {content}
            </p>
          );
        })}
      </div>
    );
  });
}

export default function DashboardPage() {
  const {
    chatMessages,
    chatId,
    activeGoalId,
    learningGoals,
    addChatMessage,
    setChatMessages,
    loadChatFromSupabase,
    syncChatToSupabase,
    addToast,
    loadLearningGoals
  } = useAppStore();

  const [activeDrawer, setActiveDrawer] = useState<'cognition' | 'revision' | 'autopsy' | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [autopsyResult, setAutopsyResult] = useState<any>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(true);

  // Chat-centric state variables
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // Autopsy upload state variables
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploadingMock, setIsUploadingMock] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragging, setDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested Prompts list
  const suggestedPrompts = [
    'Help me learn machine learning',
    'Help me crack NEET',
    'Teach me organic chemistry',
    'Build a CFA roadmap',
    'Help me learn Python'
  ];

  // 1. Initial Data Loading
  const loadTelemetry = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const loadAutopsy = async () => {
    try {
      const res = await fetch('/api/autopsy');
      if (res.ok) {
        const data = await res.json();
        setAutopsyResult(data.result);
      }
    } catch (e) {
      console.error('Failed to load autopsy data', e);
    }
  };

  useEffect(() => {
    loadChatFromSupabase();
    loadTelemetry();
    loadAutopsy();
  }, [loadChatFromSupabase]);

  // Scroll to bottom when messages or stream changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  // 2. Chat Streaming Action
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    // A. Add student message to local store
    const userMsg = {
      role: 'user' as const,
      content: textToSend.trim(),
      timestamp: new Date().toISOString()
    };
    addChatMessage(userMsg);
    setChatInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      // B. Post to global orchestrator
      const res = await fetch('/api/ai/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: chatMessages.map(m => ({ role: m.role, content: m.content })),
          currentPath: '/dashboard',
          activeGoalId: activeGoalId
        })
      });

      if (!res.ok) throw new Error('Orchestrator failed to reply.');
      if (!res.body) throw new Error('No readable response stream.');

      // C. Stream the response chunks
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullReply += chunk;
        
        // Strip token from the displayed stream in real time
        const cleanStream = fullReply.replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '').trim();
        setStreamingText(cleanStream);
      }

      // Parse drawer action if present
      const drawerMatch = fullReply.match(/\[ACTION:OPEN_DRAWER:(\w+)\]/);
      if (drawerMatch) {
        const drawerName = drawerMatch[1] as 'cognition' | 'revision' | 'autopsy';
        setActiveDrawer(drawerName);
      }

      // Clean final reply text for storage
      const cleanReply = fullReply.replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '').trim();

      // D. Append final message to store and sync with Supabase
      const assistantMsg = {
        role: 'assistant' as const,
        content: cleanReply,
        timestamp: new Date().toISOString()
      };
      addChatMessage(assistantMsg);
      await syncChatToSupabase();
      
      // E. Reload telemetry to pick up any state adjustments
      loadTelemetry();
    } catch (err: any) {
      addToast(err.message || 'Stream failed', 'error');
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      loadLearningGoals(); // reload learning goals to update sidebar/widgets
    }
  };

  // 3. Mock Autopsy Ingest
  const handleMockUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) return addToast('Please select a mock paper', 'error');

    setIsUploadingMock(true);
    setUploadStatus('Uploading and running OCR extraction...');

    const statuses = [
      'Extracting answers via Gemini 2.5 Flash...',
      'Mapping incorrect responses to syllabus chapters...',
      'Diagnosing root cognitive failures...',
      'Generating Mentor sprint plan...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < statuses.length) setUploadStatus(statuses[i++]);
    }, 2500);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('testName', fileToUpload.name);

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Autopsy failed');

      setAutopsyResult(data);
      addToast('Autopsy completed successfully!', 'success');
      loadTelemetry(); // refresh telemetry
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      clearInterval(interval);
      setIsUploadingMock(false);
      setUploadStatus('');
    }
  };

  // Find active goal title
  const activeGoal = learningGoals.find(g => g.id === activeGoalId);

  // Numeric Stats definitions
  const overallMastery = dashboardData?.cognition?.stats?.overallMastery ?? dashboardData?.profile?.overall_mastery ?? 0;
  const cardsDue = dashboardData?.revision?.dueCards?.length ?? 0;
  const marksLost = autopsyResult?.recoverableMarks ?? 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height))', marginTop: 'var(--header-height)', overflow: 'hidden', position: 'relative' }}>
      
      {/* Main Conversation Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
        
        {/* Floating Telemetry Toolbar */}
        <div style={{
          padding: 'var(--sp-3) var(--sp-6)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          zIndex: 10
        }}>
          {activeGoal ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-purple)' }} />
              Active Goal: <strong>{activeGoal.title}</strong>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Select or create a learning goal in the sidebar
            </div>
          )}

          {/* Telemetry Pills */}
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {/* Atlas Pill */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'cognition' ? null : 'cognition')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: activeDrawer === 'cognition' ? 'var(--accent-purple-dim)' : 'var(--bg-secondary)',
                border: `1px solid ${activeDrawer === 'cognition' ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                color: activeDrawer === 'cognition' ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <Brain size={12} style={{ color: 'var(--accent-purple)' }} />
              <span>ATLAS: {overallMastery}%</span>
            </button>

            {/* Memory Pill */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'revision' ? null : 'revision')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: activeDrawer === 'revision' ? 'var(--accent-blue-dim)' : 'var(--bg-secondary)',
                border: `1px solid ${activeDrawer === 'revision' ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                color: activeDrawer === 'revision' ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={12} style={{ color: 'var(--accent-blue)' }} />
              <span>MEMORY: {cardsDue} due</span>
            </button>

            {/* Autopsy Pill */}
            <button
              onClick={() => setActiveDrawer(activeDrawer === 'autopsy' ? null : 'autopsy')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: activeDrawer === 'autopsy' ? 'var(--danger-glow)' : 'var(--bg-secondary)',
                border: `1px solid ${activeDrawer === 'autopsy' ? 'var(--danger)' : 'var(--border-subtle)'}`,
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                color: activeDrawer === 'autopsy' ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              <Activity size={12} style={{ color: 'var(--danger)' }} />
              <span>AUTOPSY: -{marksLost} pts</span>
            </button>
          </div>
        </div>

        {/* Chat Messages Log */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6) var(--sp-6)' }}>
          {chatMessages.length === 0 && !isStreaming ? (
            /* Empty State: Premium Onboarding */
            <div style={{ maxWidth: '40rem', margin: 'var(--sp-12) auto 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--sp-6)' }}>
              
              <div style={{
                width: 64, height: 64, borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-glow-blue)'
              }}>
                <MessageSquare size={32} color="white" />
              </div>
              
              <div>
                <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', letterSpacing: 'var(--ls-tight)' }}>
                  What are we learning today?
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-base)', marginTop: 'var(--sp-2)' }}>
                  Cognition OS is your Socratic Thinking Partner. Ask a question, paste a syllabus, or upload a mock test.
                </p>
              </div>

              {/* Large central input box */}
              <div style={{ width: '100%', position: 'relative' }}>
                <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(chatInput); }} style={{ width: '100%' }}>
                  <div style={{
                    display: 'flex', gap: 'var(--sp-3)', alignItems: 'center',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-xl)', padding: 'var(--sp-4) var(--sp-5)',
                    boxShadow: 'var(--shadow-md)', transition: 'border-color 0.2s',
                  }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                  >
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask about thermodynamics, organic reaction pathways..."
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', fontSize: 'var(--fs-base)'
                      }}
                    />
                    <button type="submit" disabled={!chatInput.trim()} style={{
                      background: 'var(--accent-purple)', color: 'white', border: 'none',
                      borderRadius: 'var(--radius-md)', width: 36, height: 36, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity 0.2s'
                    }}>
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              </div>

              {/* Suggested Prompts Grid */}
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-tertiary)', letterSpacing: 'var(--ls-wide)', marginBottom: 'var(--sp-3)', textAlign: 'left' }}>
                  Recommended Starters
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-3)', width: '100%' }}>
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      style={{
                        padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                        textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: 'var(--sp-2)', transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-tertiary)';
                        e.currentTarget.style.borderColor = 'var(--accent-purple-dim)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      }}
                    >
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>
                        {prompt}
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* Active Conversation Mode */
            <div style={{ maxWidth: '42rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
              {chatMessages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                    animation: 'var(--animation-slide-up)'
                  }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: 'var(--sp-4) var(--sp-5)',
                      borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      background: isUser ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))' : 'var(--bg-secondary)',
                      color: isUser ? 'white' : 'var(--text-primary)',
                      border: isUser ? 'none' : '1px solid var(--border-subtle)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      {/* Message Content */}
                      {isUser ? (
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 'var(--fs-sm)' }}>{m.content}</p>
                      ) : (
                        renderMarkdown(m.content)
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Streaming AI Reply */}
              {isStreaming && streamingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: 'var(--sp-4) var(--sp-5)',
                    borderRadius: '20px 20px 20px 4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {renderMarkdown(streamingText)}
                    <span className="animate-pulse" style={{ display: 'inline-block', width: '6px', height: '14px', background: 'var(--accent-purple)', marginLeft: '2px', verticalAlign: 'middle' }} />
                  </div>
                </div>
              )}

              {/* Loader placeholder when streaming has no tokens yet */}
              {isStreaming && !streamingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-tertiary)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span style={{ fontSize: 'var(--fs-xs)' }}>Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Persistent Bottom Chat Input (Only if there are messages) */}
        {chatMessages.length > 0 && (
          <div style={{ padding: 'var(--sp-4) var(--sp-6)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-glass)' }}>
            <div style={{ maxWidth: '42rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              
              {/* Form Input Container */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(chatInput); }} style={{ width: '100%' }}>
                <div style={{
                  display: 'flex', gap: 'var(--sp-3)', alignItems: 'center',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-xl)', padding: 'var(--sp-3) var(--sp-4)',
                }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={activeGoal ? `Reply in context of "${activeGoal.title}"...` : "Ask a follow-up question..."}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: 'var(--text-primary)', fontSize: 'var(--fs-sm)'
                    }}
                  />
                  <button type="submit" disabled={!chatInput.trim() || isStreaming} style={{
                    background: 'var(--accent-purple)', color: 'white', border: 'none',
                    borderRadius: 'var(--radius-md)', width: 32, height: 32, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'opacity 0.2s'
                  }}>
                    <Send size={14} />
                  </button>
                </div>
              </form>
              
              {/* Telemetry contextual label */}
              {activeGoal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px', color: 'var(--text-tertiary)', paddingLeft: 4 }}>
                  <Target size={10} style={{ color: 'var(--accent-purple)' }} />
                  <span>AI engine constrained to active goal context.</span>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Backdrop overlay for drawers */}
      {activeDrawer && (
        <div
          onClick={() => setActiveDrawer(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)',
            zIndex: 90, animation: 'var(--animation-fade-in)'
          }}
        />
      )}

      {/* Contextual Side Drawers */}
      <div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 100vw)', background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)', zIndex: 100,
          transform: activeDrawer ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform var(--duration-normal) var(--ease-out)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {activeDrawer === 'cognition' && (
              <>
                <Brain size={18} style={{ color: 'var(--accent-purple)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>ATLAS: Cognition Graph</span>
              </>
            )}
            {activeDrawer === 'revision' && (
              <>
                <RefreshCw size={18} style={{ color: 'var(--accent-blue)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>MEMORY: Spaced Repetition Queue</span>
              </>
            )}
            {activeDrawer === 'autopsy' && (
              <>
                <Activity size={18} style={{ color: 'var(--danger)' }} />
                <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)' }}>AUTOPSY: Mistake Diagnoser</span>
              </>
            )}
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-5)' }}>
          {/* A. ATLAS / Cognition Graph Drawer */}
          {activeDrawer === 'cognition' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {dashboardData?.cognition ? (
                <CognitionDashboard data={dashboardData.cognition} />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
                  <Loader2 className="animate-spin" color="var(--accent-purple)" size={32} />
                </div>
              )}
            </div>
          )}

          {/* B. MEMORY / Revision Queue Drawer */}
          {activeDrawer === 'revision' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <RevisionQueue />
            </div>
          )}

          {/* C. AUTOPSY / Mock Ingester Drawer */}
          {activeDrawer === 'autopsy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              
              {/* Autopsy Upload State */}
              {!autopsyResult && !isUploadingMock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <Card
                    padding="lg"
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) setFileToUpload(file);
                    }}
                    style={{
                      borderStyle: 'dashed', borderWidth: '2px',
                      borderColor: dragging ? 'var(--accent-cyan)' : 'var(--border-strong)',
                      background: dragging ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', minHeight: '260px', transition: 'all 0.25s'
                    }}
                  >
                    <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-3)' }}>
                      <Upload color="var(--accent-cyan)" size={24} />
                    </div>
                    <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)', marginBottom: '4px' }}>
                      {dragging ? 'Drop to upload' : 'Drag & Drop Mock Paper'}
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
                      Support PDF, TXT, MD, or Image up to 10MB
                    </p>

                    <form onSubmit={handleMockUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', maxWidth: '16rem' }}>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,image/*"
                        onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                        style={{
                          width: '100%', padding: '4px var(--sp-2)',
                          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)'
                        }}
                      />
                      {fileToUpload && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', textAlign: 'center', background: 'var(--accent-cyan-dim)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', width: '100%' }}>
                          Staged: <strong>{fileToUpload.name}</strong>
                        </div>
                      )}
                      <Button type="submit" disabled={!fileToUpload} size="sm" style={{ width: '100%', background: 'var(--accent-cyan)', color: 'var(--text-inverse)' }}>
                        Run Diagnostic Autopsy
                      </Button>
                    </form>
                  </Card>
                </div>
              )}

              {/* Autopsy Loading State */}
              {isUploadingMock && (
                <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
                  <Loader2 color="var(--accent-cyan)" size={32} className="animate-spin" style={{ marginBottom: 'var(--sp-4)' }} />
                  <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>Extracting Mock Data...</h4>
                  <p style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>{uploadStatus}</p>
                </Card>
              )}

              {/* Autopsy Results Dashboard */}
              {autopsyResult && !isUploadingMock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                  <AutopsyDashboard result={autopsyResult} />
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
                    <Button variant="secondary" size="sm" onClick={() => { setAutopsyResult(null); setFileToUpload(null); }}>
                      Analyze Another Mock Test
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
