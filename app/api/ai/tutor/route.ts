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
      let fullResponse = '';
      try {
        // Use 'pro' model if complex RAG context is attached, else 'flash'
        const modelToUse = relevantChunks.length > 0 ? 'pro' : 'flash';
        for await (const chunk of streamText(modelToUse, TUTOR_SYSTEM_PROMPT, fullPrompt, 0.7)) {
          controller.enqueue(encoder.encode(chunk));
          fullResponse += chunk;
        }

        // Persist session
        const updatedHistory = [
          ...(history || []),
          { role: 'user', content: message },
          { role: 'assistant', content: fullResponse }
        ];
        
        // Use the supabase instance we created outside the stream
        await supabase.from('tutor_sessions').insert({
          user_id: user.id,
          concept_id: concept?.id || null,
          messages: updatedHistory,
        });

        if (concept?.id) {
          await supabase.from('concepts').update({
            times_reviewed: (concept.times_reviewed || 0) + 1,
            last_reviewed_at: new Date().toISOString()
          }).eq('id', concept.id);
        }

      } catch (err) { 
        console.error('Tutor stream error:', err);
        controller.enqueue(encoder.encode('\n\n[Error]')); 
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
