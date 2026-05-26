// components/tutor/TutorChat.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { RichMessageRenderer } from '@/components/chat/RichMessageRenderer';
import { GraduationCap, Send, BookOpen } from 'lucide-react';

interface Message {
  role: string;
  content: string;
  type?: 'success' | 'partial' | 'gap_identified';
}

export default function TutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);
    setMessages(prev => [...prev, { role: 'tutor', content: '' }]);

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: messages.filter(m => m.role !== 'system')
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
          const visibleText = chunkContent.split('\n\n===METADATA===\n')[0];
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: visibleText };
            return updated;
          });
        }

        // Parse metadata at the end of the stream
        const parts = chunkContent.split('\n\n===METADATA===\n');
        if (parts.length > 1) {
          try {
            const metadata = JSON.parse(parts[1]);
            if (metadata.action === 'session_closing_message' && metadata.closingMessage) {
              setTimeout(() => {
                setMessages(prev => [...prev, {
                  role: 'system',
                  content: metadata.closingMessage,
                  type: metadata.closingType,
                }]);
              }, 800);
            }
          } catch (e) {
            console.error('Failed to parse metadata payload:', e);
          }
        }
      }
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'tutor', content: 'Error occurred.' }; return u; });
    }
    setStreaming(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--sp-12))' }}>
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <GraduationCap size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-cyan)' }} />
          Cognition OS
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>Central Intelligence Orchestrator</p>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
            <BookOpen size={48} style={{ color: 'var(--accent-cyan)', margin: '0 auto var(--sp-4)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-secondary)' }}>How can I orchestrate your learning today?</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'system') {
            const borderColor = msg.type === 'success'
              ? 'var(--success)'
              : msg.type === 'gap_identified'
              ? 'var(--warning)'
              : 'var(--info)';

            return (
              <div key={i} style={{
                margin: 'var(--sp-4) 0',
                padding: 'var(--sp-4)',
                borderLeft: `3px solid ${borderColor}`,
                background: 'var(--bg-secondary)',
                borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}>
                {msg.content}
              </div>
            );
          }

          return (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'tutor' ? (
                <RichMessageRenderer content={msg.content} isStreaming={streaming && i === messages.length - 1} />
              ) : (
                <div style={{
                  maxWidth: '80%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-lg)',
                  background: msg.role === 'user' ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                  color: msg.role === 'user' ? 'var(--bg-root)' : 'var(--text-primary)',
                  fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-relaxed)', whiteSpace: 'pre-wrap',
                }}>
                  {msg.content || (streaming && i === messages.length - 1 ? '●' : '')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-4) 0 0', borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--sp-4)' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Talk to Cognition OS..." style={{
            flex: 1, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-base)',
        }} />
        <Button onClick={handleSend} disabled={!input.trim() || streaming}><Send size={16} /></Button>
      </div>
    </div>
  );
}
