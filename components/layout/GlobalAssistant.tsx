'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { Sparkles, X, Send, Minus } from 'lucide-react';

export default function GlobalAssistant() {
  const { isAssistantOpen, toggleAssistant, setAssistantOpen } = useAppStore();
  const pathname = usePathname();
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: 'I am here. What do you need?' }
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAssistantOpen]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/ai/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: messages, currentPath: pathname }),
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
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: updated[updated.length - 1].content + chunk };
            return updated;
          });
        }
      }
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Connection lost.' }; return u; });
    }
    setStreaming(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isAssistantOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={toggleAssistant}
            style={{
              position: 'fixed', bottom: 'var(--sp-6)', right: 'var(--sp-6)', zIndex: 900,
              width: 56, height: 56, borderRadius: 'var(--radius-full)', border: 'none',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-purple)', cursor: 'pointer',
            }}
          >
            <Sparkles size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Chat Panel */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            style={{
              position: 'fixed', bottom: 'var(--sp-6)', right: 'var(--sp-6)', zIndex: 999,
              width: 380, height: 500, borderRadius: 'var(--radius-xl)',
              background: 'var(--bg-glass)', backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>Cognition</span>
              </div>
              <button onClick={() => setAssistantOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                <Minus size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-md)', background: msg.role === 'user' ? 'var(--accent-purple)' : 'var(--bg-tertiary)', color: msg.role === 'user' ? 'white' : 'var(--text-primary)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)' }}>
                  {msg.content || (streaming && i === messages.length - 1 ? '●' : '')}
                </div>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', gap: 'var(--sp-2)' }}>
              <input 
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Ask me anything..." disabled={streaming}
                style={{ flex: 1, padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', outline: 'none', fontSize: 'var(--fs-sm)' }}
              />
              <button onClick={handleSend} disabled={!input.trim() || streaming} style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--accent-purple)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
