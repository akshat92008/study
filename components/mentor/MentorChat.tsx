'use client';

import { useState, useRef, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { MessageCircle, Send, Sparkles } from 'lucide-react';

interface Message { role: string; content: string; created_at?: string; }

export default function MentorChat({ initialHistory }: { initialHistory: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialHistory);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);

    // Add empty mentor message for streaming
    setMessages(prev => [...prev, { role: 'mentor', content: '' }]);

    try {
      const res = await fetch('/api/ai/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'mentor', content: 'Sorry, I encountered an error. Please try again.' };
        return updated;
      });
    }
    setStreaming(false);
  }

  const quickPrompts = [
    "How am I doing overall?",
    "What should I study today?",
    "I'm feeling burnt out",
    "Analyze my weak areas",
    "Create a recovery plan",
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--sp-12))' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <Sparkles size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-purple)' }} />
          AI Mentor
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-sm)' }}>
          Your elite academic coach • Powered by deep cognition analysis
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
        paddingRight: 'var(--sp-2)',
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
            <Sparkles size={48} style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-4)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)', marginBottom: 'var(--sp-6)' }}>
              Ask me anything about your preparation
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', justifyContent: 'center' }}>
              {quickPrompts.map(p => (
                <button key={p} onClick={() => { setInput(p); }} style={{
                  padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer',
                  transition: 'all var(--duration-fast)',
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '75%', padding: 'var(--sp-3) var(--sp-4)',
              borderRadius: 'var(--radius-lg)',
              background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-relaxed)',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content || (streaming && i === messages.length - 1 ? '●' : '')}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-4) 0 0',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: 'var(--sp-4)',
      }}>
        <input
          id="mentor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Talk to your mentor..."
          style={{
            flex: 1, padding: 'var(--sp-3) var(--sp-4)', fontSize: 'var(--fs-base)',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
            outline: 'none', fontFamily: 'var(--font-sans)',
          }}
        />
        <Button id="mentor-send" onClick={handleSend} disabled={!input.trim() || streaming}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
