'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, ChatMessage } from '@/stores/appStore';
import {
  Send, Paperclip, Loader2, MessageSquare, ArrowRight,
  Upload, X, RefreshCw, Target
} from 'lucide-react';

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

export default function GlobalChat() {
  const {
    chatMessages,
    activeGoalId,
    learningGoals,
    addChatMessage,
    loadChatFromSupabase,
    syncChatToSupabase,
    clearChat,
    addToast,
    loadLearningGoals,
    setActiveDrawer,
    setAutopsyResult,
    isUploadingMock,
    setIsUploadingMock,
    uploadStatus,
    setUploadStatus
  } = useAppStore();

  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [dragging, setDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageSentAt = useRef<number | null>(null);

  const suggestedPrompts = [
    'Help me learn machine learning',
    'Help me crack NEET',
    'Teach me organic chemistry',
    'Build a CFA roadmap',
    'Help me learn Python'
  ];

  // 1. Initial Chat Load
  useEffect(() => {
    loadChatFromSupabase();
  }, [loadChatFromSupabase]);

  // Scroll to bottom when messages or stream updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  // 2. Chat Sending Logic
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    lastMessageSentAt.current = Date.now();

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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullReply += chunk;
        
        const cleanStream = fullReply.replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '').trim();
        setStreamingText(cleanStream);
      }

      const responseTimeMs = lastMessageSentAt.current ? Date.now() - lastMessageSentAt.current : 0;

      const drawerMatch = fullReply.match(/\[ACTION:OPEN_DRAWER:(\w+)\]/);
      if (drawerMatch) {
        const drawerName = drawerMatch[1] as 'cognition' | 'revision' | 'autopsy';
        setActiveDrawer(drawerName);
      }

      const cleanReply = fullReply.replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '').trim();

      const assistantMsg = {
        role: 'assistant' as const,
        content: cleanReply,
        timestamp: new Date().toISOString()
      };
      addChatMessage(assistantMsg);

      fetch('/api/pulse/timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseTimeMs, messageLength: textToSend.length })
      }).catch(() => {});

      await syncChatToSupabase();
    } catch (err: any) {
      addToast(err.message || 'Stream failed', 'error');
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      loadLearningGoals();
    }
  };

  // 3. Autopsy File Drag-Drop & Input Upload Handling
  const handleAutopsyUpload = async (file: File) => {
    setIsUploadingMock(true);
    setUploadStatus('Uploading and running OCR extraction...');
    setActiveDrawer('autopsy');

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
      formData.append('file', file);
      formData.append('testName', file.name);

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Autopsy failed');

      setAutopsyResult(data);
      addToast('Autopsy completed successfully!', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      setActiveDrawer(null);
    } finally {
      clearInterval(interval);
      setIsUploadingMock(false);
      setUploadStatus('');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => {
    setDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleAutopsyUpload(file);
  };

  const activeGoal = learningGoals.find(g => g.id === activeGoalId);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: 380,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-subtle)',
        position: 'relative',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Drag & Drop Autopsy Overlay */}
      {dragging && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--sp-4)',
          zIndex: 100,
          border: '2px dashed var(--accent-cyan)',
          borderRadius: 'var(--radius-md)',
          margin: 'var(--sp-2)',
          pointerEvents: 'none'
        }}>
          <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-full)' }}>
            <Upload color="var(--accent-cyan)" size={32} />
          </div>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Drop Mock Test Here
          </h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 var(--sp-6)' }}>
            Release to instantly run full cognitive diagnosis and open Autopsy reports.
          </p>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: 'var(--sp-4) var(--sp-5)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <MessageSquare size={16} style={{ color: 'var(--accent-purple)' }} />
          <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>Socratic Tutor</span>
        </div>
        <button
          onClick={clearChat}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          title="Clear Chat"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--sp-4) var(--sp-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)'
      }}>
        {chatMessages.length === 0 && !isStreaming ? (
          /* Starter recommendations */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-black)' }}>
                What are we learning today?
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-1)' }}>
                Ask questions or drop a mock test paper to run diagnosis.
              </p>
            </div>
            
            <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-tertiary)', letterSpacing: 'var(--ls-wide)' }}>
              Recommended Starters
            </div>
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                style={{
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--sp-2)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--accent-purple-dim)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>
                  {prompt}
                </span>
                <ArrowRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        ) : (
          /* Active Chat Log */
          <>
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
                    maxWidth: '90%',
                    padding: '10px 14px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    background: isUser ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))' : 'var(--bg-primary)',
                    color: isUser ? 'white' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: 'var(--fs-sm)',
                    wordBreak: 'break-word'
                  }}>
                    {isUser ? (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                    ) : (
                      renderMarkdown(m.content)
                    )}
                  </div>
                </div>
              );
            })}

            {/* Streaming assistant text */}
            {isStreaming && streamingText && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{
                  maxWidth: '90%',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 2px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  fontSize: 'var(--fs-sm)'
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
                  <Loader2 size={14} className="animate-spin" />
                  <span style={{ fontSize: 'var(--fs-xs)' }}>Thinking...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Autopsy File uploading status view inside chat */}
      {isUploadingMock && (
        <div style={{
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)'
        }}>
          <Loader2 color="var(--accent-cyan)" size={16} className="animate-spin" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>Analyzing Mock Test...</div>
            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadStatus}</div>
          </div>
        </div>
      )}

      {/* Input Form Box */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(chatInput); }}
            style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}
          >
            {/* Paperclip upload trigger */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.txt,.md,image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAutopsyUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploadingMock}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 'var(--sp-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                transition: 'color 0.2s'
              }}
              title="Upload Mock Test for Autopsy"
            >
              <Paperclip size={16} />
            </button>

            {/* Input Element */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '6px 10px',
              transition: 'border-color 0.2s'
            }}
              onFocusCapture={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
              onBlurCapture={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={activeGoal ? `Reply in context of goal...` : "Ask a follow-up..."}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--fs-xs)'
                }}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isStreaming || isUploadingMock}
                style={{
                  background: 'var(--accent-purple)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  opacity: chatInput.trim() ? 1 : 0.6,
                  transition: 'opacity 0.2s'
                }}
              >
                <Send size={12} />
              </button>
            </div>
          </form>

          {/* Constraint Label */}
          {activeGoal && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '9px', color: 'var(--text-tertiary)', paddingLeft: 4 }}>
              <Target size={9} style={{ color: 'var(--accent-purple)' }} />
              <span>AI constrained to active goal context.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
