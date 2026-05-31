import { SupabaseClient } from '@supabase/supabase-js';
import { routeStreamGeneration } from '@/lib/ai/router';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { MASTERY_WEIGHTS } from '@/lib/engines/cognition-graph';
import { logger } from '@/lib/utils/logger';

export class ChatTutorService {
  static async handleTutorSession(
    supabase: SupabaseClient,
    userId: string,
    intent: any,
    mindContext: any,
    systemPrompt: string,
    recentHistory: any[],
    message: string,
    sessionTurnsCount: number | undefined,
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder
  ) {
    const topic = intent.topic || 'General';
    const subject = intent.subject || mindContext?.weakConcepts?.[0]?.subject || 'General';
    const conceptId = await resolveConceptByName(userId, subject, topic);
    
    if (!conceptId) {
      logger.warn('CONCEPT_RESOLUTION_FAILURE', { userId, subject, chapter: topic, reason: 'No matching concept found for tutoring session' });
    }
    
    const { data: mistakes } = await supabase
      .from('mistakes')
      .select('category, ai_analysis')
      .eq('user_id', userId)
      .ilike('chapter', `%${topic}%`)
      .limit(5);

    let pastSessionCtx = '';
    let oldMasteryScore: number | null = null;
    
    if (conceptId) {
      const { data: conceptRec } = await supabase.from('concepts').select('mastery').eq('id', conceptId).single();
      if (conceptRec?.mastery) {
        oldMasteryScore = MASTERY_WEIGHTS[conceptRec.mastery as keyof typeof MASTERY_WEIGHTS] ?? null;
      }
      const { data: pastSessions } = await supabase.from('tutor_sessions').select('summary, started_at')
        .eq('user_id', userId).eq('concept_id', conceptId).not('summary', 'is', null).order('started_at', { ascending: false }).limit(3);
      if (pastSessions?.length) {
        pastSessionCtx = '\n\nPAST SESSIONS ON THIS TOPIC:\n' + pastSessions.map((s: any) => `- [${new Date(s.started_at).toLocaleDateString()}] ${s.summary}`).join('\n');
      }
    }

    const tutorSystemPrompt = `${systemPrompt}\n\nACTIVE TUTOR SESSION:\nTopic: ${subject} > ${topic}\nPast Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join('; ') || 'None'}${pastSessionCtx}\n\nYou are now in active teaching mode for this topic. Apply RULE 3 (Learning Mode) — Socratic method, minimum 6-10 exchanges.`;
    const conversationMessages = buildConversationMessages(recentHistory, message);
    const hasUserSpecificContext = (mistakes && mistakes.length > 0) || (pastSessionCtx && pastSessionCtx.length > 0) || (oldMasteryScore !== null);
    const canCache = isCacheable({ intent: intent.intent, hasUserContext: hasUserSpecificContext });
    const cached = canCache && message ? await checkSemanticCache(message, userId) : null;

    let fullResponse = '';

    if (cached) {
      controller.enqueue(encoder.encode(cached));
      fullResponse = cached;
    } else {
      for await (const chunk of routeStreamGeneration(tutorSystemPrompt, conversationMessages, 0.75)) {
        controller.enqueue(encoder.encode(chunk));
        fullResponse += chunk;
      }
      if (canCache && message) {
        setSemanticCache(message, fullResponse, userId).catch(err => logger.error('Cache save failed', err));
      }
    }

    let metadataPayload: any = null;
    const isSessionComplete = sessionTurnsCount ? (sessionTurnsCount >= 6) : (recentHistory.length >= 10);
    if (isSessionComplete && recentHistory.length > 0) {
      metadataPayload = { 
        action: 'session_closing_message', 
        closingMessage: "We've covered a lot today. I'm analyzing our session in the background and will update your knowledge map and flashcards shortly.", 
        closingType: 'async_analysis', 
        sessionComplete: true 
      };
    }

    return { fullResponse, metadataPayload };
  }
}
