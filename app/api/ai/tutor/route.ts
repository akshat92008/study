import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { getTutorSystemPrompt, buildTutorContext } from '@/lib/ai/prompts/tutor';
import { searchPersonalKnowledge } from '@/lib/engines/rag-engine';
import { getStudentContext } from '@/lib/engines/student-context-engine';
import { getPrerequisiteChain, updateConceptState } from '@/lib/engines/cognition-graph';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';
import { rateLimit } from '@/lib/utils/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    // Limit: 50 requests per 15 minutes per user
    const ip = req.headers.get('x-forwarded-for') || user.id;
    if (!await rateLimit(ip, 50, 15 * 60 * 1000)) {
      return new Response('Rate limit exceeded. Please wait a few minutes.', { status: 429 });
    }

    const { message, subject, chapter, history } = await req.json();

    // 1. Fetch Deep Student Context & Current Concept
    const [studentContext, conceptRes] = await Promise.all([
      getStudentContext(user.id, subject || '', chapter || ''),
      supabase.from('concepts').select('*')
        .eq('user_id', user.id).eq('subject', subject || '').eq('chapter', chapter || '').single()
    ]);

    const concept = conceptRes.data;
    
    // 1.5 Fetch Prerequisite and Longitudinal Context
    let prerequisites: any[] = [];
    let pastSessions: any[] = [];
    
    if (concept?.id) {
      prerequisites = await getPrerequisiteChain(concept.id);
      
      // Fetch all concept IDs in the same subject and chapter to locate all related past conversations
      const { data: chapterConcepts } = await supabase
        .from('concepts')
        .select('id')
        .eq('user_id', user.id)
        .eq('subject', subject || '')
        .eq('chapter', chapter || '');
      
      const conceptIds = chapterConcepts && chapterConcepts.length > 0
        ? chapterConcepts.map((c: any) => c.id)
        : [concept.id];

      const { data: sessions } = await supabase
        .from('tutor_sessions')
        .select('started_at, summary')
        .eq('user_id', user.id)
        .in('concept_id', conceptIds)
        .not('summary', 'is', null)
        .order('started_at', { ascending: false })
        .limit(5);
      if (sessions) pastSessions = sessions;
    }

    const telemetryContext = buildTutorContext(studentContext, subject || 'General', chapter || 'General', concept, pastSessions, prerequisites);

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
          const sysPrompt = getTutorSystemPrompt(studentContext.exam.type || 'CUSTOM');
          const streamStartTime = Date.now();
          for await (const chunk of streamText(modelToUse, sysPrompt, fullPrompt, 0.4)) { // Lower temp for factual rigor
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
          const latency = Date.now() - streamStartTime;

          // 6. Asynchronous Telemetry & Session Saving
          const updatedHistory = [
            ...(history || []),
            { role: 'user', content: message },
            { role: 'assistant', content: fullResponse }
          ];

          // 6. Asynchronous Telemetry, Analysis & Session Saving
          Promise.resolve().then(async () => {
            try {
              // Create the analysis prompt
              const analysisPrompt = `Analyze this tutor session. Did the student demonstrate clear understanding of the concept? Are there any specific knowledge gaps remaining? 
              
              Session:
              ${historyText}
              Student: ${message}
              MIND: ${fullResponse}
              
              Respond EXACTLY as JSON:
              {
                "summary": "1-sentence summary of what was discussed",
                "studentDemonstratedUnderstanding": true/false,
                "knowledgeGaps": [
                  { "front": "Question testing the gap", "back": "The answer" }
                ]
              }`;
              
              // Ask Gemini to analyze the conversation
              const analysis = await generateJSON<any>('flash', 'You are an expert tutor session analyzer.', analysisPrompt);
              
              // Save the session record
              await supabase.from('tutor_sessions').insert({
                user_id: user.id,
                concept_id: concept?.id || null,
                messages: updatedHistory,
                cognitive_level: updatedHistory.length > 10 ? 'advanced' : 'intermediate',
                understanding_gained: analysis.studentDemonstratedUnderstanding ? 10 : 2,
                summary: analysis.summary,
              });

              // Log PULSE Signal: Track if the student is getting frustrated
              const messageLength = message.length;
              const isShortOrFrustrated = messageLength < 10 || 
                /\b(stuck|confused|hard|cannot|help|fail|error|wrong|bad|frustrated)\b/i.test(message);
              const emotionalState = isShortOrFrustrated ? 'frustrated' : 'neutral';

              await supabase.from('pulse_signals').insert({
                user_id: user.id,
                signal_type: 'tutor_interaction',
                emotional_state: emotionalState,
                confidence: isShortOrFrustrated ? 0.8 : 0.5,
                notes: `Msg len: ${messageLength}, stream latency: ${latency}ms`,
                interaction_count: 1,
              });

              // --- THE PIPELINE: ATLAS & MEMORY WRITE-BACK ---
              if (concept?.id) {
                // ATLAS Write-back: Bump mastery up if they understood!
                if (analysis.studentDemonstratedUnderstanding) {
                  await updateConceptState(concept.id, true, 0); 
                } else {
                  // Just log a review but no correct mark
                  await supabase.from('concepts').update({
                    times_reviewed: (concept.times_reviewed || 0) + 1,
                    last_reviewed_at: new Date().toISOString()
                  }).eq('id', concept.id);
                }
                
                // MEMORY Write-back: Auto-create flashcards for identified gaps
                if (analysis.knowledgeGaps && analysis.knowledgeGaps.length > 0) {
                  for (const gap of analysis.knowledgeGaps) {
                    await createSingleCard(
                      user.id, 
                      concept.id, 
                      gap.front, 
                      gap.back, 
                      subject || 'General', 
                      chapter || 'General'
                    );
                  }
                }
              }
            } catch (analysisErr) {
              logger.error('Post-session analysis failed', analysisErr);
            }
          });

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
