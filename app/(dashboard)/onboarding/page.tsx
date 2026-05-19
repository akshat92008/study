'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import { Sparkles, Send, Loader2, BrainCircuit, CheckCircle, UploadCloud, Paperclip } from 'lucide-react';

export default function ConversationalOnboarding() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello. I'm Cognition. I'll be running your academic schedule from now on. What exactly are we preparing for, and when is the exam?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [buildState, setBuildState] = useState<'chat' | 'compiling' | 'ready'>('chat');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startCompilationSequence = () => {
    setBuildState('compiling');
    // Simulate dramatic compilation sequence
    setTimeout(() => setBuildState('ready'), 3500);
    setTimeout(() => router.push('/dashboard'), 5500);
  };

  const handleSend = async () => {
    if (!input.trim() || loading || buildState !== 'chat') return;
    
    const userMsg = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMsg }];
    setMessages(newHistory);
    setLoading(true);
    setUploadError(null);

    try {
      const res = await fetch('/api/ai/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, history: newHistory.slice(0, -1) }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      if (data.isComplete) {
        startCompilationSequence();
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Network error. Try again?" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || buildState !== 'chat') return;

    setLoading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      setMessages(prev => [...prev, { role: 'user', content: `Uploaded document: ${file.name}` }]);
      const res = await fetch('/api/onboarding/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to parse syllabus');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: `Brilliant! I've loaded your "${data.title}" curriculum and seeded the ATLAS nodes successfully.` }]);
      startCompilationSequence();
    } catch (err: any) {
      setUploadError(err.message || 'Syllabus processing failed.');
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: `I had trouble extracting details from that document. Let's continue conversing: what exam are you preparing for?` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-root)', padding: 'var(--sp-4)' }}>
      <AnimatePresence mode="wait">
        {buildState === 'chat' ? (
          <motion.div key="chat" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} style={{ width: '100%', maxWidth: 600 }}>
            <Card padding="lg" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-purple-dim)', boxShadow: 'var(--shadow-glow-purple)' }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-4)' }}>
                <Sparkles size={32} style={{ color: 'var(--accent-purple)', margin: '0 auto var(--sp-2)' }} />
                <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)' }}>System Initialization</h2>
              </div>

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

                {messages.length === 1 && (
                  <div style={{ padding: '0 var(--sp-4)' }}>
                    <div 
                      onClick={triggerFileSelect}
                      style={{
                        border: '2px dashed var(--accent-purple-dim)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--sp-6)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(168, 85, 247, 0.02)',
                        transition: 'background var(--duration-fast) var(--ease-out)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--sp-2)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.02)'; }}
                    >
                      <UploadCloud size={32} style={{ color: 'var(--accent-purple)' }} />
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Onboarding Magic Ingestion
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
                        Upload a syllabus, test series index, or checklist PDF/Image. Gemini will seed ATLAS instantly.
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".pdf,.png,.jpg,.jpeg,.txt" 
                        style={{ display: 'none' }} 
                      />
                    </div>
                  </div>
                )}

                {loading && (
                  <div style={{ color: 'var(--accent-purple)', padding: 'var(--sp-3) var(--sp-4)' }}>
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', padding: 'var(--sp-2)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                  <Paperclip size={20} />
                  <input 
                    type="file" 
                    accept=".pdf,.png,.jpg,.jpeg,.txt" 
                    style={{ display: 'none' }}
                    onChange={handleFileUpload} 
                  />
                </label>
                <input 
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Type your response or attach syllabus..." disabled={loading}
                  style={{ flex: 1, padding: 'var(--sp-4)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', outline: 'none', fontSize: 'var(--fs-base)' }}
                />
                <button onClick={handleSend} disabled={loading || !input.trim()} style={{ width: 50, height: 50, borderRadius: 'var(--radius-full)', background: 'var(--accent-purple)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Send size={20} />
                </button>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="compiling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', color: 'var(--accent-cyan)' }}>
            <motion.div animate={buildState === 'compiling' ? { rotate: 360 } : {}} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: 'var(--sp-6)' }}>
              {buildState === 'compiling' ? <BrainCircuit size={64} /> : <CheckCircle size={64} color="var(--success)" />}
            </motion.div>
            <motion.h2 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase', color: buildState === 'ready' ? 'var(--success)' : 'var(--accent-cyan)' }}>
              {buildState === 'compiling' ? 'Compiling Neural Graph...' : 'System Online'}
            </motion.h2>
            <p style={{ marginTop: 'var(--sp-3)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {buildState === 'compiling' ? 'Mapping syllabus constraints • Initializing FSRS decay weights • Generating daily mission parameters' : 'Redirecting to Command Center...'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
