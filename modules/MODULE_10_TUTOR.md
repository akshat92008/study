# MODULE 10: AI Tutor System

## PROMPT FOR AI BUILDER

```
Build the Adaptive AI Tutor for Cognition OS.
It adapts explanations to cognitive level and past confusion history.
Uses streaming Gemini responses. Similar architecture to MODULE 8 (Mentor).
Create: lib/ai/prompts/tutor.ts, API route, page, and chat component.
```

---

## STEP 1: Tutor System Prompt — `lib/ai/prompts/tutor.ts`

```typescript
export const TUTOR_SYSTEM_PROMPT = `You are an expert adaptive tutor inside Cognition OS, specializing in NEET exam preparation.

## Your Teaching Method
- NEVER just give the answer. Guide the student to understand.
- Use the Socratic method — ask guiding questions when appropriate.
- Adapt your explanation to the student's cognitive level:
  - Beginner: Use analogies, simple language, step-by-step breakdown
  - Intermediate: Use proper scientific terminology, connect to related concepts
  - Advanced: Discuss edge cases, exam tricks, time-saving methods
- Include relevant formulas using LaTeX notation ($...$) when needed
- For Biology: Focus on diagrams, mnemonics, and classification patterns
- For Physics: Focus on conceptual understanding before formulas
- For Chemistry: Focus on reaction mechanisms and patterns

## Response Format
- Use markdown formatting
- Bold key terms
- Use bullet points for steps
- Include formulas with $ for inline math
- Keep explanations concise but thorough
- End with a quick check question to test understanding

## Rules
1. Be patient and encouraging but rigorous
2. If the student is wrong, explain WHY they're wrong before correcting
3. Connect every concept to how it appears in NEET questions
4. Include NEET-specific tips (common traps, frequently tested aspects)
5. If asked about a concept, also mention its prerequisites`;

export function buildTutorContext(concept: any, mistakes: any[]) {
  return `
## Current Topic
Subject: ${concept?.subject || 'General'}
Chapter: ${concept?.chapter || 'Not specified'}
Student Mastery: ${concept?.mastery || 'unknown'}
Times Reviewed: ${concept?.times_reviewed || 0}

## Past Mistakes in This Area
${mistakes.length > 0
  ? mistakes.map(m => `- ${m.category}: ${m.ai_analysis || 'No analysis'}`).join('\n')
  : '- No recorded mistakes'}`;
}
```

---

## STEP 2: API Route — `app/api/ai/tutor/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText } from '@/lib/ai/provider-client';
import { TUTOR_SYSTEM_PROMPT, buildTutorContext } from '@/lib/ai/prompts/tutor';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, subject, chapter, history } = await req.json();

  // Get concept context
  const { data: concept } = await supabase
    .from('concepts')
    .select('*')
    .eq('user_id', user.id)
    .eq('subject', subject || '')
    .eq('chapter', chapter || '')
    .single();

  const { data: mistakes } = await supabase
    .from('mistakes')
    .select('category, ai_analysis')
    .eq('user_id', user.id)
    .eq('subject', subject || '')
    .limit(5);

  const context = buildTutorContext(concept, mistakes || []);
  const historyText = (history || []).slice(-8).map((m: any) =>
    `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`
  ).join('\n');

  const fullPrompt = `${context}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamText('flash', TUTOR_SYSTEM_PROMPT, fullPrompt, 0.7)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch { controller.enqueue(encoder.encode('\n\n[Error]')); }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

---

## STEP 3: Tutor Page — `app/(dashboard)/tutor/page.tsx`

```tsx
import TutorChat from '@/components/tutor/TutorChat';

export default function TutorPage() {
  return <TutorChat />;
}
```

---

## STEP 4: Tutor Chat Component — `components/tutor/TutorChat.tsx`

This component is structurally similar to MentorChat (MODULE 8) but with:
- Subject/chapter selector at the top
- Different color scheme (cyan accent instead of purple)
- Different quick prompts

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { GraduationCap, Send, BookOpen } from 'lucide-react';
import { NEET_SUBJECTS, NEET_CHAPTERS } from '@/lib/utils/constants';

interface Message { role: string; content: string; }

export default function TutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState(NEET_CHAPTERS['Physics'][0]);
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
          <select value={subject} onChange={e => { setSubject(e.target.value); setChapter(NEET_CHAPTERS[e.target.value][0]); }} style={{
            padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)',
          }}>
            {NEET_SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={chapter} onChange={e => setChapter(e.target.value)} style={{
            padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', flex: 1,
          }}>
            {(NEET_CHAPTERS[subject] || []).map(c => <option key={c}>{c}</option>)}
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
```

---

## VERIFICATION

```bash
npm run dev
# Navigate to /dashboard/tutor
# Select a subject and chapter, ask a question
# Response should stream with adaptive teaching style
```

**→ NEXT: MODULE 11 (Analytics Dashboard)**
