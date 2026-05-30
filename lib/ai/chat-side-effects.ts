import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { captureSentryException } from '@/lib/telemetry/sentry-runtime';

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
    intent
  } = input;

  // 1. Student Model Sync Trigger. Message persistence happens in the chat
  // route before this event is published; this worker must never duplicate it.
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
        await EventDispatcher.publish({
          user_id: userId,
          type: 'STUDENT_MODEL_SYNC_REQUESTED',
          data: { isEarlyFingerprint },
          metadata: { source: 'chat_side_effects' },
          idempotency_key: `sync:${userId}:${totalMessageCount}`
        });
      }
    }
  } catch (err) {
    logger.warn('SideEffect: Student model sync trigger failed', err);
  }

  // 2.5. Session Summarization Trigger
  try {
    if (history && history.length > 10 && history.length % 5 === 0) {
      await EventDispatcher.publish({
        user_id: userId,
        type: 'CHAT_SESSION_SUMMARIZE',
        data: { sessionId, messageCount: history.length },
        metadata: { source: 'chat_side_effects' },
        idempotency_key: `summarize:${sessionId}:${history.length}`
      });
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
