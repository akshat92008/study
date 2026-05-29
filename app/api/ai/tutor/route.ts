// app/api/ai/tutor/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';


import { logger } from '@/lib/utils/logger';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { createSingleCard } from '@/lib/engines/revision-engine';
import { updateConceptState } from '@/lib/engines/cognition-graph';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { generateJSON } from '@/lib/ai/gemini';
import { routeStreamGeneration, routeEmbedding } from '@/lib/ai/router';

import { generateSessionClosingMessage } from '@/lib/engines/session-closing';

import { buildConversationMessages } from '@/lib/ai/chat-intent';
function buildTutorContext(concept: any, mistakes: any[]) {
  return `
## Current Topic
Subject: ${concept?.subject || 'General'}
Chapter: ${concept?.chapter || 'Not specified'}
Student Mastery: ${concept?.mastery || 'unknown'}
Times Reviewed: ${concept?.times_reviewed || 0}

## Past Mistakes in This Area
${mistakes.length > 0
  ? mistakes.map((m: any) => `- ${m.category}: ${m.ai_analysis || 'No analysis'}`).join('\n')
  : '- No recorded mistakes'}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, subject, chapter, history } = await req.json();

  // Build context similar to chat route
  const mindContext = await getMINDContext(user.id, message);
  const systemPrompt = getMINDSystemPrompt(mindContext, []);

  // Resolve concept and fetch mistakes for tutoring
  const conceptId = await resolveConceptByName(user.id, subject || mindContext.weakConcepts?.[0]?.subject || 'General', chapter || 'General');
  if (!conceptId) {
    logger.warn('CONCEPT_RESOLUTION_FAILURE', { userId: user.id, subject: subject || mindContext.weakConcepts?.[0]?.subject || 'General', chapter: chapter || 'General', reason: 'No matching concept found for tutor session' });
  }
  const { data: mistakes } = await supabase.from('mistakes').select('category, ai_analysis').eq('user_id', user.id).ilike('chapter', `%${chapter || ''}%`).limit(5);

  const tutorContext = buildTutorContext({ subject, chapter }, mistakes || []);
  const historyText = (history || []).slice(-8).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
  const fullPrompt = `${tutorContext}\n\n## Conversation\n${historyText}\n\nStudent: ${message}`;

  const tutorSystemPrompt = `${systemPrompt}\n\nACTIVE TUTOR SESSION:\nSubject: ${subject || 'General'}\nChapter: ${chapter || 'General'}\nPast Mistakes: ${mistakes?.map(m => m.ai_analysis).join('; ') || 'None'}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        // Generate response using router similar to chat route
        for await (const chunk of routeStreamGeneration(tutorSystemPrompt, buildConversationMessages(history || [], message || ''), 0.75)) {
          controller.enqueue(encoder.encode(chunk));
          fullResponse += chunk;
        }

        // Perform session analysis
        let analysis: any = { understood: false, gapFound: null, gapAnswer: null, summary: '' };
        try {
          const historySnippet = (history || []).slice(-6).map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 200)}`).join('\n');
          const analysisPrompt = `Analyze this tutor exchange.\n${historySnippet}\nStudent: ${message}\nTutor: ${fullResponse.slice(0, 800)}\n\nRespond ONLY as JSON:\n{\"summary\":\"1 sentence\",\"understood\":true,\"gapFound\":\"flashcard question or null\",\"gapAnswer\":\"flashcard answer or null\"}`;
          const raw = await generateJSON<any>('flash', 'Expert analyzer. Return JSON only.', analysisPrompt);
          if (raw && typeof raw.understood === 'boolean') {
            analysis = { understood: raw.understood, gapFound: raw.gapFound?.length > 5 ? raw.gapFound : null, gapAnswer: raw.gapAnswer?.length > 5 ? raw.gapAnswer : null, summary: raw.summary || '' };
          }
        } catch (err) { /* ignore analysis errors */ }

        // Create flashcard if needed
        if (!analysis.understood && analysis.gapFound && analysis.gapAnswer) {
          try {
            await createSingleCard(user.id, conceptId || null, analysis.gapFound, analysis.gapAnswer, subject, chapter);
          } catch (e) { /* ignore */ }
        }

        const currentTutorSessionId = `tutor-${Date.now()}`;
        // Update concept state and store session
        if (conceptId) {
          const estimatedTime = Math.max(60, (history?.length || 0) * 30);
          await updateConceptState(conceptId, analysis.understood, estimatedTime);
          await supabase.from('tutor_sessions').insert({
            user_id: user.id,
            session_id: currentTutorSessionId,
            concept_id: conceptId,
            summary: analysis.summary,
            messages: [...(history || []), { role: 'user', content: message }, { role: 'assistant', content: fullResponse }]
          });
          // Trigger aggressive initial profiling for first three tutor sessions
          const { count } = await supabase.from('tutor_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
          if (count && count <= 3) {
            await syncStudentModel(user.id, true).catch(() => {});
          }
        }
        await syncStudentModel(user.id).catch(() => {});

        // Closing message
        const closing = await generateSessionClosingMessage({
          userId: user.id,
          conceptId: conceptId || null,
          subject,
          chapter,
          gapFound: analysis.gapFound,
          gapAnswer: analysis.gapAnswer,
          understood: analysis.understood,
          turnsCount: history?.length || 0,
          oldMastery: null,
          newMastery: null,
          cardsCreated: (!analysis.understood && analysis.gapFound) ? 1 : 0,
          sessionId: currentTutorSessionId
        }).catch(() => null);
        if (closing) {
          controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify({ action: 'session_closing_message', closingMessage: closing.text, closingType: closing.type })}`));
        }
      } catch (e) {
        controller.enqueue(encoder.encode('\n\n[Error]'));
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}



