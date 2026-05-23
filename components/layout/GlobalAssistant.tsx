'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ChatMessage } from '@/stores/appStore';
import { Sparkles, Send, Minus, Trash2 } from 'lucide-react';

export default function GlobalAssistant() {
  const {
    isAssistantOpen,
    toggleAssistant,
    setAssistantOpen,
    chatMessages,
    addChatMessage,
    loadChatFromSupabase,
    clearChat,
    loadLearningGoals,
    activeGoalId,
  } = useAppStore();

  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentStreamedText, setCurrentStreamedText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatFromSupabase();
  }, [loadChatFromSupabase]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, currentStreamedText, isAssistantOpen]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const userContent = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);

    setStreaming(true);
    setCurrentStreamedText('');

    try {
      // ✅ FIX: All traffic now goes through the canonical /api/ai/chat route.
      // History format matches what /api/ai/chat expects: { role, content }[]
      const historyForApi = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
          history: historyForApi,
          activeGoalId: activeGoalId ?? null,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        accumulatedText += chunk;

        // Strip metadata trailer before displaying
        const displayText = accumulatedText
          .replace(/\n\n===METADATA===\n[\s\S]*$/, '')
          .replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '')
          .trim();
        setCurrentStreamedText(displayText);
      }

      // Parse metadata trailer for client-side actions
      const metadataMatch = accumulatedText.match(/===METADATA===\n([\s\S]+)$/);
      if (metadataMatch) {
        try {
          const meta = JSON.parse(metadataMatch[1]);
          if (meta.action && meta.action.startsWith('show_')) {
            const { setActiveDrawer } = useAppStore.getState();
            const drawerName = meta.action.replace('show_', '') as any;
            setActiveDrawer(drawerName);
          }
        } catch { /* metadata parse failures are non-fatal */ }
      }

      const cleanReply = accumulatedText
        .replace(/\n\n===METADATA===\n[\s\S]*$/, '')
        .replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '')
        .trim();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: cleanReply || 'Done.',
        timestamp: new Date().toISOString(),
      };
      addChatMessage(assistantMsg);
    } catch (error) {
      console.error('GlobalAssistant stream error:', error);
      addChatMessage({
        role: 'assistant',
        content: 'Connection lost. Try again.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setStreaming(false);
      setCurrentStreamedText('');
      loadLearningGoals();
    }
  };

  const displayMessages = [...chatMessages];
  if (streaming && currentStreamedText) {
    displayMessages.push({
      role: 'assistant',
      content: currentStreamedText,
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <AnimatePresence>
      {isAssistantOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            width: '380px',
            maxHeight: '560px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-tertiary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)' }}>
                Cognition
              </span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={clearChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' }}>
                <Trash2 size={14} />
              </button>
              <button onClick={toggleAssistant} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px' }}>
                <Minus size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayMessages.length === 0 && (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', textAlign: 'center', marginTop: '40px' }}>
                What are we working on today?
              </p>
            )}
            {displayMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                color: msg.role === 'user' ? 'var(--bg-primary)' : 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: '8px', padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)',
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask anything..."
              disabled={streaming}
              style={{
                flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', padding: '8px 12px', color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)', outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              style={{
                background: 'var(--accent-cyan)', border: 'none', borderRadius: 'var(--radius-md)',
                padding: '8px 12px', cursor: 'pointer', color: 'var(--bg-primary)',
                opacity: streaming || !input.trim() ? 0.5 : 1,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
