'use client';

import { useState, useRef, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { GraduationCap, Send, BookOpen } from 'lucide-react';

interface Message { role: string; content: string; }

export default function TutorChat({ concepts }: { concepts?: any[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  // Derive subjects and chapters from user's actual concepts
  const subjectChapterMap: Record<string, string[]> = {};
  (concepts || []).forEach((c: any) => {
    if (!subjectChapterMap[c.subject]) subjectChapterMap[c.subject] = [];
    if (!subjectChapterMap[c.subject].includes(c.chapter)) subjectChapterMap[c.subject].push(c.chapter);
  });
  const userSubjects = Object.keys(subjectChapterMap).length > 0 ? Object.keys(subjectChapterMap) : ['General'];
  const [subject, setSubject] = useState(userSubjects[0]);
  const [chapter, setChapter] = useState((subjectChapterMap[userSubjects[0]] || ['General'])[0]);
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
    setMessages(prev => [...prev, { role: 'tutor', content: '' }]);

    try {
      const res = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, subject, chapter, history: messages }),
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
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'tutor', content: 'Error occurred.' }; return u; });
    }
    setStreaming(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - var(--sp-12))' }}>
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <GraduationCap size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-cyan)' }} />
          AI Tutor
        </h1>
        {/* Subject/Chapter selectors */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
          <select value={subject} onChange={e => { setSubject(e.target.value); setChapter((subjectChapterMap[e.target.value] || ['General'])[0]); }} style={{
            padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)',
          }}>
            {userSubjects.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={chapter} onChange={e => setChapter(e.target.value)} style={{
            padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', flex: 1,
          }}>
            {(subjectChapterMap[subject] || []).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0' }}>
            <BookOpen size={48} style={{ color: 'var(--accent-cyan)', margin: '0 auto var(--sp-4)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-secondary)' }}>Ask anything about {chapter}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-lg)',
              background: msg.role === 'user' ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
              color: msg.role === 'user' ? 'var(--bg-root)' : 'var(--text-primary)',
              fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-relaxed)', whiteSpace: 'pre-wrap',
            }}>
              {msg.content || (streaming && i === messages.length - 1 ? '●' : '')}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--sp-4) 0 0', borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--sp-4)' }}>
        <input id="tutor-input" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={`Ask about ${chapter}...`}
          style={{
            flex: 1, padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-secondary)',
            color: 'var(--text-primary)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-base)',
          }} />
        <Button onClick={handleSend} disabled={!input.trim() || streaming}><Send size={16} /></Button>
      </div>
    </div>
  );
}
