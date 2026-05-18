import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText } from '@/lib/ai/gemini';
import { TUTOR_SYSTEM_PROMPT, buildTutorContext } from '@/lib/ai/prompts/tutor';
import { searchPersonalKnowledge } from '@/lib/engines/rag-engine';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, subject, chapter, history } = await req.json();

  // 1. RAG: Search the student's personal uploaded materials
  const relevantChunks = await searchPersonalKnowledge(user.id, message);
  const ragContext = relevantChunks.length > 0 
    ? `\n\n## Student's Personal Uploaded Notes\n${relevantChunks.map((c: any) => `- "${c.chunk_text}"`).join('\n')}`
    : '';

  // 2. Get standard concept/mistake context
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

  // 3. Combine it all
  const fullPrompt = `${context}${ragContext}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Use 'pro' model if complex RAG context is attached, else 'flash'
        const modelToUse = relevantChunks.length > 0 ? 'pro' : 'flash';
        for await (const chunk of streamText(modelToUse, TUTOR_SYSTEM_PROMPT, fullPrompt, 0.7)) {
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
