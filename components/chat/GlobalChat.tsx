'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, ChatMessage } from '@/stores/appStore';
import { RichMessageRenderer } from './RichMessageRenderer';
import {
  Send, Paperclip, Loader2, MessageSquare, ArrowRight,
  Upload, X, RefreshCw, Target, FileText, AlertTriangle, Image as ImageIcon
} from 'lucide-react';

function renderMarkdown(text: string) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```')) {
      const match = part.match(/```([a-zA-Z]*)\n?([\s\S]*?)```/);
      const code = match ? match[2] : part.slice(3, -3);
      return (
        <pre key={idx} style={{
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)', margin: 'var(--sp-3) 0',
          overflowX: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)',
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
            content = boldParts.map((bp, bpIdx) =>
              bp.startsWith('**') && bp.endsWith('**')
                ? <strong key={bpIdx} style={{ fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{bp.slice(2, -2)}</strong>
                : bp
            );
          }
          if (line.trim().startsWith('- ')) return <li key={lIdx} style={{ marginLeft: 'var(--sp-4)', listStyleType: 'disc', color: 'var(--text-secondary)' }}>{line.trim().substring(2)}</li>;
          if (/^\d+\.\s/.test(line.trim())) return <li key={lIdx} style={{ marginLeft: 'var(--sp-4)', listStyleType: 'decimal', color: 'var(--text-secondary)' }}>{line.trim().replace(/^\d+\.\s/, '')}</li>;
          if (line.trim().startsWith('### ')) return <h4 key={lIdx} style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 'var(--sp-2)' }}>{line.trim().substring(4)}</h4>;
          if (line.trim().startsWith('## ')) return <h3 key={lIdx} style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 'var(--sp-3)' }}>{line.trim().substring(3)}</h3>;
          if (line.trim().startsWith('# ')) return <h2 key={lIdx} style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-black)', color: 'var(--text-primary)', marginTop: 'var(--sp-4)' }}>{line.trim().substring(2)}</h2>;
          return <p key={lIdx} style={{ margin: '2px 0', minHeight: line.trim() === '' ? '8px' : 'auto', color: 'var(--text-secondary)' }}>{content}</p>;
        })}
      </div>
    );
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 45_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function makeInlineErrorMessage(detail: string): ChatMessage {
  return { role: 'assistant', content: `⚠️ ${detail}`, timestamp: new Date().toISOString() };
}

// Converts a File to base64 string
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:mime;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

interface SessionCardProps {
  day: number;
  streak: number;
  focus: string;
  duration: number;
  reason: string;
  onStart: () => void;
}

function DailySessionCard({ day, streak, focus, duration, reason, onStart }: SessionCardProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 24px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.08em'
        }}>
          DAY {day}
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--warning)',
          background: 'rgba(249, 115, 22, 0.12)',
          padding: '2px 10px',
          borderRadius: 'var(--radius-md)'
        }}>
          🔥 {streak} day streak
        </span>
      </div>

      <p style={{
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        marginBottom: '4px',
        fontWeight: 500,
        letterSpacing: '0.06em'
      }}>
        TODAY'S FOCUS
      </p>

      <p style={{
        fontSize: '18px',
        fontWeight: 500,
        color: 'var(--text-primary)',
        marginBottom: '4px'
      }}>
        {focus} · {duration} minutes
      </p>

      <p style={{
        fontSize: '13px',
        color: 'var(--text-secondary)',
        marginBottom: '16px'
      }}>
        {reason}
      </p>

      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: '12px',
          background: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer'
        }}
      >
        Start Session
      </button>
    </div>
  );
}

export default function GlobalChat() {
  const {
    chatMessages, activeGoalId, learningGoals,
    addChatMessage, loadChatFromSupabase, syncChatToSupabase, clearChat,
    addToast, loadLearningGoals, setActiveDrawer, setAutopsyResult,
    isUploadingMock, setIsUploadingMock, uploadStatus, setUploadStatus
  } = useAppStore();

  const [chatInput, setChatInput] = useState('');
  const [sessionCard, setSessionCard] = useState<any>(null);

  useEffect(() => {
    async function loadSessionCard() {
      try {
        const res = await fetch('/api/dashboard/session-card');
        if (res.ok) {
          const data = await res.json();
          setSessionCard(data);
        }
      } catch (err) {
        // Silently fail — don't block chat
      }
    }
    loadSessionCard();
  }, []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isProcessingDoubt, setIsProcessingDoubt] = useState(false);
  const [doubtStatus, setDoubtStatus] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageSentAt = useRef<number | null>(null);

  const suggestedPrompts = [
    'What should I study today?',
    'I feel overwhelmed — adjust my plan',
    'Quiz me on what I studied yesterday',
    'What are my weakest topics right now?',
    'Make me a revision sheet on my current topic',
  ];

  useEffect(() => { loadChatFromSupabase(); }, [loadChatFromSupabase]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, streamingText]);

  const readStreamIntoChat = async (res: Response): Promise<string> => {
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
    return fullReply;
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;
    lastMessageSentAt.current = Date.now();

    // Capture history BEFORE adding new message — prevents double-send
    const historySnapshot = chatMessages.map(m => ({ role: m.role, content: m.content }));

    addChatMessage({ role: 'user', content: textToSend.trim(), timestamp: new Date().toISOString() });
    setChatInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      let res: Response;
      try {
        res = await fetchWithTimeout('/api/ai/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend.trim(),
            history: historySnapshot,  // ← snapshot before new message
            currentPath: '/dashboard',
            activeGoalId
          })
        });
      } catch (fetchErr: any) {
        const isTimeout = fetchErr?.name === 'AbortError';
        addChatMessage(makeInlineErrorMessage(
          isTimeout ? 'Request timed out (45s). Try a shorter message.' : 'Could not reach the server. Check your connection.'
        ));
        return;
      }

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        const detail = res.status === 429
          ? 'Too many messages — wait a minute before sending again.'
          : res.status === 401 ? 'Session expired. Please refresh.' : `AI error (${res.status}). ${errorBody}`.trim();
        addChatMessage(makeInlineErrorMessage(detail));
        return;
      }

      const fullReply = await readStreamIntoChat(res);
      const drawerMatch = fullReply.match(/\[ACTION:OPEN_DRAWER:(\w+)\]/);
      if (drawerMatch) setActiveDrawer(drawerMatch[1] as 'cognition' | 'revision' | 'autopsy');

      const cleanReply = fullReply.replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '').trim();
      if (cleanReply) {
        addChatMessage({ role: 'assistant', content: cleanReply, timestamp: new Date().toISOString() });
      }

      const responseTimeMs = lastMessageSentAt.current ? Date.now() - lastMessageSentAt.current : 0;
      fetch('/api/pulse/timing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseTimeMs, messageLength: textToSend.length })
      }).catch(() => {});

      await syncChatToSupabase();
    } catch {
      addChatMessage(makeInlineErrorMessage('An unexpected error occurred reading the response.'));
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      loadLearningGoals();
    }
  };

  // ── IMAGE-AWARE doubt handler ──────────────────────────────────────────
  // Images → base64 → Gemini multimodal (NOT through text extraction)
  // Documents → text extraction → AI
  const handleDoubtUpload = async (file: File) => {
    const isImage = IMAGE_MIME_TYPES.includes(file.type);
    setIsProcessingDoubt(true);
    setDoubtStatus(isImage ? 'Reading your image...' : 'Extracting document text...');
    setPendingFile(null);

    try {
      const historySnapshot = chatMessages.map(m => ({ role: m.role, content: m.content }));
      const userText = chatInput.trim();
      setChatInput('');

      let requestBody: any;
      let displayContent: string;

      if (isImage) {
        // ── IMAGE PATH: base64 → multimodal Gemini ──
        const base64Data = await fileToBase64(file);
        displayContent = userText || 'Solve this question';
        requestBody = {
          message: userText || 'Please solve this question step by step and explain the concept behind it.',
          imageBase64: base64Data,
          imageMimeType: file.type,
          history: historySnapshot,
          currentPath: '/dashboard',
          activeGoalId
        };
      } else {
        // ── DOCUMENT PATH: text extraction ──
        const formData = new FormData();
        formData.append('file', file);
        const ingestRes = await fetch('/api/ingest', { method: 'POST', body: formData });
        const ingestData = await ingestRes.json();
        if (!ingestRes.ok) throw new Error(ingestData.error || 'Failed to read document');

        const extractedText = ingestData.text || '';
        // Store only first 3000 chars in chat display — full text goes to API separately
        displayContent = userText || 'Explain this document';
        requestBody = {
          message: `Document: "${file.name}"\n\n${userText ? `My question: ${userText}\n\n` : ''}Content:\n${extractedText.slice(0, 40000)}`,
          history: historySnapshot,
          currentPath: '/dashboard',
          activeGoalId
        };
      }

      // Add user message to chat with clean display
      addChatMessage({
        role: 'user',
        content: displayContent,
        timestamp: new Date().toISOString(),
        metadata: { type: isImage ? 'image_upload' : 'file_upload', fileName: file.name, userQuery: displayContent }
      });

      setIsStreaming(true);
      setStreamingText('');
      lastMessageSentAt.current = Date.now();

      let apiRes: Response;
      try {
        apiRes = await fetchWithTimeout('/api/ai/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }, 60_000); // 60s for images
      } catch (fetchErr: any) {
        const isTimeout = fetchErr?.name === 'AbortError';
        addChatMessage(makeInlineErrorMessage(isTimeout ? 'Timed out processing your file.' : 'Could not reach the server.'));
        return;
      }

      if (!apiRes.ok) {
        addChatMessage(makeInlineErrorMessage(`AI error (${apiRes.status}) while analysing your ${isImage ? 'image' : 'document'}.`));
        return;
      }

      const fullReply = await readStreamIntoChat(apiRes);
      const drawerMatch = fullReply.match(/\[ACTION:OPEN_DRAWER:(\w+)\]/);
      if (drawerMatch) setActiveDrawer(drawerMatch[1] as any);

      const cleanReply = fullReply.replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '').trim();
      if (cleanReply) {
        addChatMessage({ role: 'assistant', content: cleanReply, timestamp: new Date().toISOString() });
      }

      const responseTimeMs = lastMessageSentAt.current ? Date.now() - lastMessageSentAt.current : 0;
      fetch('/api/pulse/timing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseTimeMs, messageLength: file.size })
      }).catch(() => {});

      await syncChatToSupabase();
    } catch (err: any) {
      addChatMessage(makeInlineErrorMessage('Failed to process your file. Try again.'));
    } finally {
      setIsProcessingDoubt(false);
      setDoubtStatus('');
      setStreamingText('');
      setIsStreaming(false);
      loadLearningGoals();
    }
  };

  const handleAutopsyUpload = async (file: File) => {
    setIsUploadingMock(true);
    setUploadStatus('Uploading mock test...');
    setActiveDrawer('autopsy');
    const statuses = ['Extracting answers via Gemini 2.5 Flash...', 'Mapping mistakes to syllabus chapters...', 'Diagnosing root cognitive failures...', 'Generating recovery sprint plan...'];
    let i = 0;
    const interval = setInterval(() => { if (i < statuses.length) setUploadStatus(statuses[i++]); }, 2500);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('testName', file.name);
      const res = await fetch('/api/autopsy/ingest', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Autopsy failed');
      setAutopsyResult(data);
      addToast('Autopsy complete — recovery plan generated.', 'success');
    } catch (err: any) {
      addToast(err.message, 'error');
      setActiveDrawer(null);
    } finally {
      clearInterval(interval);
      setIsUploadingMock(false);
      setUploadStatus('');
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setPendingFile(file);
  };

  const activeGoal = learningGoals.find(g => g.id === activeGoalId);

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-subtle)',
      position: 'relative', overflow: 'hidden'
    }}>

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(5,7,12,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--sp-6)', maxWidth: 320, width: '90%'
          }}>
            <h3 style={{ fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Clear conversation?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
              This removes messages from your view. Your OS memory and learning history are preserved.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <button onClick={() => setShowClearConfirm(false)} style={{
                flex: 1, padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--fs-sm)'
              }}>Cancel</button>
              <button onClick={() => { clearChat(); setShowClearConfirm(false); }} style={{
                flex: 1, padding: '8px', background: 'var(--accent-purple)', border: 'none',
                borderRadius: 'var(--radius-md)', color: 'white', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 'bold'
              }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Drag Overlay */}
      {dragging && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(5,7,12,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--sp-4)', zIndex: 100, border: '2px dashed var(--accent-cyan)',
          borderRadius: 'var(--radius-md)', margin: 'var(--sp-2)', pointerEvents: 'none'
        }}>
          <Upload color="var(--accent-cyan)" size={32} />
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold', color: 'var(--text-primary)' }}>Drop File Here</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textAlign: 'center', padding: '0 var(--sp-6)' }}>
            Image of a question → instant solve. Mock test PDF → full autopsy.
          </p>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <MessageSquare size={16} style={{ color: 'var(--accent-purple)' }} />
          <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>Cognition OS</span>
          {activeGoal && (
            <span style={{
              fontSize: '10px', background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)',
              padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 'bold'
            }}>{activeGoal.title}</span>
          )}
        </div>
        <button onClick={() => setShowClearConfirm(true)} style={{
          background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4
        }} title="Clear Chat">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {sessionCard && chatMessages.length === 0 && (
          <DailySessionCard
            day={sessionCard.dayNumber}
            streak={sessionCard.streakDays}
            focus={sessionCard.focusTopic}
            duration={sessionCard.durationMinutes}
            reason={sessionCard.reason}
            onStart={() => {
              clearChat();
              handleSendMessage(`Start today's session on ${sessionCard.focusTopic}`);
              setSessionCard(null); // Hide card once started
            }}
          />
        )}

        {chatMessages.length === 0 && !isStreaming ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-6)' }}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-black)' }}>What are we working on today?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-1)' }}>
                Ask anything. Upload an image of a question. Drop a mock test.
              </p>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', fontWeight: 'bold', color: 'var(--text-tertiary)', letterSpacing: 'var(--ls-wide)' }}>Quick Start</div>
            {suggestedPrompts.map((prompt, idx) => (
              <button key={idx} onClick={() => handleSendMessage(prompt)} style={{
                padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)', textAlign: 'left', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-2)'
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--accent-purple-dim)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>{prompt}</span>
                <ArrowRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        ) : (
          <>
            {chatMessages.map((m, idx) => {
              const isUser = m.role === 'user';
              const isFile = m.metadata?.type === 'file_upload' || m.metadata?.type === 'image_upload';
              const isError = !isUser && m.content.startsWith('⚠️');

              return (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  width: '100%',
                  alignItems: 'flex-start',
                  gap: 8
                }}>
                  {/* AI avatar */}
                  {!isUser && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: 'white'
                    }}>
                      C
                    </div>
                  )}

                  <div style={{
                    maxWidth: isUser ? '78%' : '92%',
                    padding: isUser ? '10px 14px' : '12px 16px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '2px 16px 16px 16px',
                    background: isUser
                      ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))'
                      : isError ? 'rgba(245,158,11,0.06)' : 'var(--bg-primary)',
                    color: isUser ? 'white' : 'var(--text-primary)',
                    border: isUser ? 'none' : isError ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--border-subtle)',
                    fontSize: 13,
                    wordBreak: 'break-word'
                  }}>
                    {isUser ? (
                      isFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {m.metadata?.type === 'image_upload'
                            ? <ImageIcon size={14} style={{ color: '#a5f3fc' }} />
                            : <FileText size={14} style={{ color: '#a5f3fc' }} />
                          }
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{m.metadata?.fileName}</div>
                            {m.metadata?.userQuery && <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{m.metadata.userQuery}</div>}
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</p>
                      )
                    ) : (
                      <RichMessageRenderer content={m.content} />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Streaming message */}
            {isStreaming && streamingText && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: 'white'
                }}>C</div>
                <div style={{
                  maxWidth: '92%', padding: '12px 16px',
                  borderRadius: '2px 16px 16px 16px', background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)', fontSize: 13
                }}>
                  <RichMessageRenderer content={streamingText} isStreaming={true} />
                </div>
              </div>
            )}
            {isStreaming && !streamingText && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-tertiary)' }}>
                <Loader2 size={14} className="animate-spin" />
                <span style={{ fontSize: 'var(--fs-xs)' }}>Thinking...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Status bars */}
      {isUploadingMock && (
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Loader2 color="var(--accent-cyan)" size={16} className="animate-spin" />
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold' }}>Analysing Mock Test...</div>
            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{uploadStatus}</div>
          </div>
        </div>
      )}
      {isProcessingDoubt && (
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Loader2 color="var(--accent-purple)" size={16} className="animate-spin" />
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold' }}>Processing File...</div>
            <div style={{ fontSize: '10px', color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{doubtStatus}</div>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', backdropFilter: 'blur(8px)' }}>
        {pendingFile && (
          <div style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--accent-purple-dim)',
            borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', marginBottom: 'var(--sp-2)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                {IMAGE_MIME_TYPES.includes(pendingFile.type)
                  ? <ImageIcon size={14} style={{ color: 'var(--accent-cyan)' }} />
                  : <Paperclip size={14} style={{ color: 'var(--accent-purple)' }} />
                }
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>{pendingFile.name}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>({(pendingFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => setPendingFile(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button onClick={() => handleDoubtUpload(pendingFile)} disabled={isStreaming || isProcessingDoubt} style={{
                flex: 1, background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}>
                {IMAGE_MIME_TYPES.includes(pendingFile.type) ? <><ImageIcon size={12} /> Solve Question</> : <><MessageSquare size={12} /> Clear Doubts</>}
              </button>
              <button onClick={() => { const f = pendingFile; setPendingFile(null); handleAutopsyUpload(f); }}
                disabled={isStreaming || isProcessingDoubt} style={{
                  flex: 1, background: 'transparent', color: 'var(--text-primary)',
                  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                  fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                }}>
                <Target size={12} style={{ color: 'var(--accent-cyan)' }} /> Run Autopsy
              </button>
            </div>
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); handleSendMessage(chatInput); }} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <input type="file" ref={fileInputRef} accept=".pdf,.txt,.md,image/*" style={{ display: 'none' }}
            onChange={e => { const file = e.target.files?.[0]; if (file) { setPendingFile(file); e.target.value = ''; } }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isStreaming || isUploadingMock || isProcessingDoubt}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 'var(--sp-1)' }} title="Attach image or document">
            <Paperclip size={16} />
          </button>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-primary)',
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '6px 10px'
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
          >
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(chatInput); } }}
              placeholder="Ask anything or describe what you need..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)' }} />
            <button type="submit" disabled={!chatInput.trim() || isStreaming || isUploadingMock || isProcessingDoubt}
              style={{
                background: 'var(--accent-purple)', color: 'white', border: 'none',
                borderRadius: 'var(--radius-sm)', width: 24, height: 24, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                opacity: chatInput.trim() ? 1 : 0.4
              }}>
              <Send size={12} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
