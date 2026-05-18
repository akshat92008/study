import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText } from '@/lib/ai/gemini';
import { TUTOR_SYSTEM_PROMPT, buildTutorContext } from '@/lib/ai/prompts/tutor';
import { searchPersonalKnowledge } from '@/lib/engines/rag-engine';
import { getStudentContext } from '@/lib/engines/student-context-engine';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { message, subject, chapter, history } = await req.json();

    // 1. Fetch Deep Student Context & Current Concept
    const [studentContext, conceptRes] = await Promise.all([
      getStudentContext(user.id, subject || '', chapter || ''),
      supabase.from('concepts').select('*')
        .eq('user_id', user.id).eq('subject', subject || '').eq('chapter', chapter || '').single()
    ]);

    const concept = conceptRes.data;
    const telemetryContext = buildTutorContext(studentContext, subject || 'General', chapter || 'General', concept);

    // 2. High-Fidelity RAG Search
    // Boost threshold and limit to ensure we only get highly relevant notes, reducing noise.
    const relevantChunks = await searchPersonalKnowledge(user.id, `${subject} ${chapter}: ${message}`, 0.55, 4);
    const ragContext = relevantChunks.length > 0 
      ? `\n\n## STUDENT'S PERSONAL NOTES (SOURCE MATERIAL)\n${relevantChunks.map((c: any) => `> "${c.chunk_text}"`).join('\n\n')}`
      : '';

    // 3. Construct Final Prompt
    const historyText = (history || []).slice(-6).map((m: any) =>
      `${m.role === 'user' ? 'Student' : 'MIND'}: ${m.content}`
    ).join('\n');

    const fullPrompt = `${telemetryContext}${ragContext}\n\n## ACTIVE DIALOGUE\n${historyText}\nStudent: ${message}`;

    // 4. Determine Model Strategy
    // Pro is required if RAG context is heavy, otherwise Flash is fast enough for quick Socratic volleys.
    const modelToUse = relevantChunks.length > 0 ? 'pro' : 'flash';

    logger.info('Tutor session initiated', { userId: user.id, subject, chapter, model: modelToUse });

    // 5. Streaming Response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        try {
          for await (const chunk of streamText(modelToUse, TUTOR_SYSTEM_PROMPT, fullPrompt, 0.4)) { // Lower temp for factual rigor
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }

          // 6. Asynchronous Telemetry & Session Saving
          const updatedHistory = [
            ...(history || []),
            { role: 'user', content: message },
            { role: 'assistant', content: fullResponse }
          ];
          
          // Save session
          await supabase.from('tutor_sessions').insert({
            user_id: user.id,
            concept_id: concept?.id || null,
            messages: updatedHistory,
            // Automatically upgrade cognitive level tracking based on history length
            cognitive_level: updatedHistory.length > 10 ? 'advanced' : 'intermediate',
            understanding_gained: 5, // Arbitrary base gain per deep interaction
          });

          // Update Concept Mastery
          if (concept?.id) {
            await supabase.from('concepts').update({
              times_reviewed: (concept.times_reviewed || 0) + 1,
              last_reviewed_at: new Date().toISOString()
            }).eq('id', concept.id);
          }

        } catch (err: any) { 
          logger.error('Tutor stream error', err);
          controller.enqueue(encoder.encode('\n\n[System Error: Cognitive connection lost. Please try again.]')); 
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    logger.error('Tutor API Failure', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
