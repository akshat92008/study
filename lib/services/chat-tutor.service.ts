import { SupabaseClient } from '@supabase/supabase-js';
import { budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { MASTERY_WEIGHTS } from '@/lib/engines/cognition-graph';
import { logger } from '@/lib/utils/logger';
import { MIN_MIND_TUTOR_COVERAGE_TURNS } from '@/lib/mind/tutor-completion';

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

    const tutorSystemPrompt = `${systemPrompt}\n\nACTIVE TUTOR SESSION:\nTopic: ${subject} > ${topic}\nPast Mistakes Here: ${mistakes?.map((m: any) => m.ai_analysis).join('; ') || 'None'}${pastSessionCtx}\n\nYou are now in active teaching mode for this topic. Apply RULE 3 (Learning Mode) — Socratic method, minimum ${MIN_MIND_TUTOR_COVERAGE_TURNS}-10 exchanges before the concept is considered covered.\n\nCRITICAL: Review the conversation history before replying. Do NOT repeat concepts, questions, or analogies you have already used in this session. If the user understands the current sub-topic, move on to the next related sub-topic or increase the difficulty.`;
    const conversationMessages = buildConversationMessages(recentHistory, message);
    const hasUserSpecificContext = (mistakes && mistakes.length > 0) || (pastSessionCtx && pastSessionCtx.length > 0) || (oldMasteryScore !== null);
    const canCache = isCacheable({ intent: intent.intent, hasUserContext: hasUserSpecificContext });
    
    // Disable caching for tutor sessions if we are deep into the session, as it needs to be highly contextual
    const isDeepSession = (recentHistory?.length || 0) > 4;
    const cached = canCache && !isDeepSession && message ? await checkSemanticCache(message, userId) : null;

    let fullResponse = '';

    if (cached) {
      controller.enqueue(encoder.encode(cached));
      fullResponse = cached;
    } else {
      const generator = await budgetedStreamGeneration({
        userId,
        feature: 'chat',
        route: 'chat:tutor',
        model: 'pro',
        systemPrompt: tutorSystemPrompt,
        userPrompt: conversationMessages,
        maxOutputTokens: 1600,
      });
      for await (const chunk of generator) {
        controller.enqueue(encoder.encode(chunk));
        fullResponse += chunk;
      }
      if (canCache && message) {
        setSemanticCache(message, fullResponse, userId).catch(err => logger.error('Cache save failed', err));
      }
    }

    let metadataPayload: any = null;
    const isSessionComplete = sessionTurnsCount
      ? (sessionTurnsCount >= MIN_MIND_TUTOR_COVERAGE_TURNS)
      : (recentHistory.filter((turn: any) => turn?.role === 'user').length + 1 >= MIN_MIND_TUTOR_COVERAGE_TURNS);
    if (isSessionComplete && recentHistory.length > 0) {
      metadataPayload = { 
        action: 'session_closing_message', 
        closingMessage: `Session recorded for ${subject} / ${topic}. I have enough turns to update your progress map and review cards from this exact exchange.`,
        closingType: 'async_analysis', 
        sessionComplete: true,
        subject,
        chapter: topic,
        conceptId,
        oldMastery: oldMasteryScore,
        minCoverageTurns: MIN_MIND_TUTOR_COVERAGE_TURNS,
        coverageTurns: sessionTurnsCount ?? recentHistory.filter((turn: any) => turn?.role === 'user').length + 1,
      };
    }

    return { fullResponse, metadataPayload };
  }
}
