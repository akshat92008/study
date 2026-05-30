import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { captureSentryException } from '@/lib/telemetry/sentry-runtime';

import { persistChatMessage } from '@/lib/services/chat-persistence';
import { trackDailyAIUsage } from '@/lib/services/ai-usage.service';

export interface ChatSideEffectsInput {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  message: string;
  fullResponse: string;
  emotion: string;
  history: any[];
  sessionTurnsCount: number;
  mindContext: any;
  intent: any;
  metadataPayload?: any;
}

export async function processChatSideEffects(input: ChatSideEffectsInput) {
  const {
    supabase,
    userId,
    sessionId,
    message,
    fullResponse,
    emotion,
    history,
    sessionTurnsCount,
    mindContext,
    intent,
    metadataPayload
  } = input;

  // 0. Persistence and Billing
  try {
    await persistChatMessage(supabase, {
      sessionId,
      userId,
      role: 'assistant',
      content: fullResponse,
      intent: intent?.intent,
      emotionalState: emotion,
      metadata: metadataPayload ?? {},
    });

    await trackDailyAIUsage({
      userId,
      kind: 'chat',
      route: '/api/ai/chat',
      model: 'router:chat',
      promptTokens: Math.ceil((message || '').length / 4),
      completionTokens: Math.ceil((fullResponse || '').length / 4),
    });
  } catch (err) {
    logger.error('SideEffect: Persistence and billing failed', err);
  }

  // 1. Student Model Sync Trigger.
  try {
    const { count: totalMessageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user');

    if (totalMessageCount !== null) {
      const isEarlyFingerprint = [1, 5, 10].includes(totalMessageCount);
      const isRoutineRefresh = totalMessageCount > 10 && totalMessageCount % 25 === 0;

      if (isEarlyFingerprint || isRoutineRefresh) {
        await syncStudentModel(userId, isEarlyFingerprint, supabase).catch((err) => {
          logger.warn('SideEffect: Student model sync failed', err);
        });
      }
    }
  } catch (err) {
    logger.warn('SideEffect: Student model sync trigger failed', err);
  }

  // 2.5. Session Summarization Trigger
  try {
    if (history && history.length > 10 && history.length % 5 === 0) {
      logger.info('SideEffect: chat summary due', { sessionId, messageCount: history.length });
    }
  } catch (err) {
    logger.warn('SideEffect: Summarization trigger failed', err);
  }

  // 3. Semantic Memory Storage
  try {
    const memSvc = new ChatMemoryService();
    await memSvc.storeMessageInMemory(userId, message);
  } catch (err) {
    captureSentryException(err, { tags: { context: 'semantic_memory_storage' } });
  }

  // 4. Emotion State Update
  try {
    if (emotion !== 'neutral') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('emotional_state')
        .eq('id', userId)
        .single();
        
      if (profile?.emotional_state !== emotion) {
        await supabase
          .from('profiles')
          .update({ emotional_state: emotion })
          .eq('id', userId);
      }
    }
  } catch (err) {
    captureSentryException(err, { tags: { context: 'emotion_state_update' } });
  }

  // 5. Event Publishing
  try {
    const sessionSubject = mindContext?.currentTopic?.subject || mindContext?.weakConcepts?.[0]?.subject;
    const sessionChapter = mindContext?.currentTopic?.chapter || mindContext?.weakConcepts?.[0]?.chapter;

    if (sessionSubject && sessionChapter && sessionSubject !== 'General') {
      const messageCount = history?.length || 1;
      const estimatedMinutes = Math.max(5, Math.round(messageCount * 1.5));
      const isSessionComplete = sessionTurnsCount ? (sessionTurnsCount >= 6) : (history && history.length >= 10);

      const { EventDispatcher } = await import('@/lib/events/orchestrator');
      await EventDispatcher.publish({
        user_id: userId,
        type: 'MIND_TUTOR_COMPLETED',
        data: {
          conceptId: null,
          subject: sessionSubject,
          chapter: sessionChapter,
          durationMinutes: estimatedMinutes,
          messageCount,
          sessionType: mindContext?.sessionType || 'chat',
          history: (history || []).slice(-6),
          latestMessage: message,
          latestResponse: fullResponse,
          isSessionComplete,
          intent: intent.intent
        },
        metadata: { source: 'chat' },
        idempotency_key: `session:${userId}:${sessionSubject}:${sessionChapter}:${new Date().toISOString().slice(0, 16)}`,
      });
    }
  } catch (err) {
    captureSentryException(err, { tags: { context: 'event_publishing' } });
  }
}
