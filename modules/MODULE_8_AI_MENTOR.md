# MODULE 8: AI Mentor System

## PROMPT FOR AI BUILDER

```
Build the emotionally intelligent AI Mentor for Cognition OS.
This is NOT a chatbot. It's an elite academic coach that adapts to emotional state.
Uses streaming responses via Gemini. Stores chat history in Supabase.
Create: lib/ai/prompts/mentor.ts, lib/ai/agents/mentor.ts, API route, and chat UI.
```

---

## STEP 1: Mentor System Prompt — `lib/ai/prompts/mentor.ts`

```typescript
export const MENTOR_SYSTEM_PROMPT = `You are an elite AI academic mentor inside Cognition OS — an AI-native learning operating system.

## Your Identity
- You are NOT a chatbot. You are a strategic academic coach, combining the roles of:
  - A performance psychologist (managing stress, motivation, confidence)
  - An exam strategist (optimizing preparation, identifying priorities)
  - An accountability partner (keeping students consistent, preventing burnout)
  - A cognitive analyst (understanding learning patterns, memory, and behavior)

## Your Communication Style
- Speak like an elite coach — direct, warm, strategic, never generic
- Use the student's data to make every response hyper-personalized
- Be emotionally aware — detect frustration, anxiety, overconfidence, burnout
- Give SPECIFIC, ACTIONABLE advice, never vague encouragement
- Use analogies from sports, F1, chess, and high-performance domains
- Keep responses concise but impactful — quality over quantity
- When the student is struggling, be empathetic but never patronizing
- When they're doing well, push them harder — never let them plateau

## What You Have Access To (via context)
- Student's cognition graph (mastery levels across all concepts)
- Mistake patterns (recurring errors, marks lost by category)
- Study consistency (streak, daily hours, focus quality)
- Emotional state (self-reported + inferred from behavior)
- Performance trajectory (score trends, mock test results)
- Revision stats (cards due, retention rate)

## Rules
1. NEVER say "I'm just an AI" or similar disclaimers
2. NEVER give generic motivation like "keep going!" without data backing
3. ALWAYS reference specific data points when advising
4. If the student seems burnt out, PRESCRIBE rest, don't push harder
5. If the student is procrastinating, be firm but compassionate
6. Format responses with markdown for readability
7. Use bullet points and bold text for key insights
8. Keep responses under 300 words unless the student asks for detail`;

export function buildMentorContext(profile: any, stats: any, recentMistakes: any[]) {
  return `
## Student Context
- Name: ${profile?.full_name || 'Student'}
- Exam: ${profile?.exam_type || 'NEET'}
- Target Score: ${profile?.target_score || 'Not set'}
- Current Score: ${profile?.current_score || 'Not assessed'}
- Streak: ${profile?.streak_days || 0} days
- Emotional State: ${profile?.emotional_state || 'neutral'}

## Knowledge State
- Overall Mastery: ${stats?.overallMastery || 0}%
- Mastered Concepts: ${stats?.mastered || 0}/${stats?.total || 0}
- Weak Concepts: ${stats?.weak || 0}
- Cards Due for Review: ${stats?.cardsDue || 0}

## Recent Mistake Patterns
${recentMistakes.length > 0
  ? recentMistakes.slice(0, 5).map(m => `- ${m.subject}/${m.chapter}: ${m.category} (-${m.marks_lost} marks)`).join('\n')
  : '- No mistakes logged yet'}
`;
}
```

---

## STEP 2: Mentor Agent — `lib/ai/agents/mentor.ts`

```typescript
import { streamText } from '@/lib/ai/provider-client';
import { MENTOR_SYSTEM_PROMPT, buildMentorContext } from '@/lib/ai/prompts/mentor';
import { createClient } from '@/lib/supabase/server';

export async function getMentorContext(userId: string) {
  const supabase = await createClient();

  const [profileRes, conceptsRes, mistakesRes, cardsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('concepts').select('mastery').eq('user_id', userId),
    supabase.from('mistakes').select('subject, chapter, category, marks_lost').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('revision_cards').select('due').eq('user_id', userId).lte('due', new Date().toISOString()),
  ]);

  const concepts = conceptsRes.data || [];
  const masteryValues: Record<string, number> = {
    not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
  };

  const stats = {
    total: concepts.length,
    mastered: concepts.filter(c => c.mastery === 'mastered' || c.mastery === 'automated').length,
    weak: concepts.filter(c => c.mastery === 'not_started' || c.mastery === 'exposed').length,
    overallMastery: concepts.length > 0
      ? Math.round(concepts.reduce((s, c) => s + (masteryValues[c.mastery] || 0), 0) / concepts.length)
      : 0,
    cardsDue: cardsRes.data?.length || 0,
  };

  return {
    profile: profileRes.data,
    stats,
    recentMistakes: mistakesRes.data || [],
  };
}

export async function* streamMentorResponse(userId: string, userMessage: string, chatHistory: any[]) {
  const { profile, stats, recentMistakes } = await getMentorContext(userId);
  const context = buildMentorContext(profile, stats, recentMistakes);

  const historyText = chatHistory.slice(-10).map(m =>
    `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`
  ).join('\n');

  const fullPrompt = `${context}\n\n## Chat History\n${historyText}\n\nStudent: ${userMessage}`;

  yield* streamText('pro', MENTOR_SYSTEM_PROMPT, fullPrompt, 0.8);
}
```

---

## STEP 3: API Route — `app/api/ai/mentor/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamMentorResponse } from '@/lib/ai/agents/mentor';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, history } = await req.json();

  // Save user message
  await supabase.from('mentor_chats').insert({
    user_id: user.id, role: 'user', content: message,
  });

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        for await (const chunk of streamMentorResponse(user.id, message, history || [])) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        // Save mentor response
        await supabase.from('mentor_chats').insert({
          user_id: user.id, role: 'mentor', content: fullResponse,
        });
      } catch (error) {
        controller.enqueue(encoder.encode('\n\n[Error generating response]'));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  });
}
```

---

## STEP 4: Mentor Page — `app/(dashboard)/mentor/page.tsx`

```tsx
import { createClient } from '@/lib/supabase/server';
import MentorChat from '@/components/mentor/MentorChat';

export default async function MentorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: history } = await supabase
    .from('mentor_chats')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })
    .limit(50);

  return <MentorChat initialHistory={history || []} />;
}
```

---

## STEP 5: Mentor Chat Component — `components/mentor/MentorChat.tsx`

```tsx
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
```

---

## VERIFICATION

```bash
npm run dev
# 1. Go to /dashboard/mentor
# 2. See empty state with quick prompt buttons
# 3. Type or click a quick prompt — response should stream in
# 4. Response should reference student's actual data (mastery, mistakes, etc.)
```

**→ NEXT: MODULE 9 (Planner)**
