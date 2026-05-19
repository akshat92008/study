'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { Sparkles, Send, Loader2 } from 'lucide-react';

export default function ConversationalOnboarding() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello. I'm Cognition. I'll be running your academic schedule from now on. What exactly are we preparing for, and when is the exam?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [buildingSystem, setBuildingSystem] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || buildingSystem) return;
    
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: newHistory.slice(0, -1) }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.isComplete) {
        setBuildingSystem(true);
        // Wait 3 seconds to let them read the final message, then redirect to the dashboard
        setTimeout(() => {
          router.push('/dashboard');
        }, 3500);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Network error. Try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-root)' }}>
      <Card padding="lg" style={{ maxWidth: 600, width: '100%', minHeight: '60vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-purple-dim)', boxShadow: 'var(--shadow-glow-purple)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-4)' }}>
          <Sparkles size={32} style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-2)' }} />
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>System Initialization</h2>
        </div>

        {/* Chat History */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-lg)',
                background: msg.role === 'user' ? 'var(--bg-active)' : 'transparent',
                color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--accent-purple)',
                fontSize: 'var(--fs-md)', lineHeight: 'var(--lh-relaxed)',
                border: msg.role === 'assistant' ? 'none' : '1px solid var(--border-subtle)',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && !buildingSystem && (
            <div style={{ color: 'var(--accent-purple)', fontSize: 'var(--fs-md)', padding: 'var(--sp-3) var(--sp-4)' }}>
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </div>

        {/* Big Loading State when complete */}
        {buildingSystem ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--accent-cyan)' }}>
            <Loader2 size={32} className="animate-spin mx-auto" style={{ margin: '0 auto var(--sp-3)' }} />
            <p style={{ fontWeight: 'var(--fw-bold)' }}>Compiling your Neural Network & Daily Missions...</p>
          </div>
        ) : (
          /* Input Field */
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Type your response..."
              disabled={loading}
              style={{
                flex: 1, padding: 'var(--sp-4)', background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-full)', outline: 'none', fontSize: 'var(--fs-base)'
              }}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                width: 50, height: 50, borderRadius: 'var(--radius-full)',
                background: 'var(--accent-purple)', color: 'white', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <Send size={20} />
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
