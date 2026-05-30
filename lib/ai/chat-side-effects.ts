// lib/ai/chat-side-effects.ts
//
// MODULE 3 PATCH: This function is the worker's side-effect handler for
// CHAT_MESSAGE_PROCESSED events. It must NEVER insert assistant chat messages.
// The route is the single source of truth for message persistence.
//
// Worker responsibilities (this file):
//   1. Student model sync trigger
//   2. Session summarization trigger
//   3. Semantic memory storage
//   4. Emotional state update
//   5. MIND_TUTOR_COMPLETED event derivation
//
// Removed from this file:
//   ✗  persistChatMessage  (was section 0 — route owns this now)
//   ✗  trackDailyAIUsage   (moved to finalizeChatResponse in the route context)

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
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
  metadataPayload?: any;
  /** The id of the already-persisted assistant chat_messages row.
   *  Present in all events published after the MODULE 3 patch.
   *  Used for logging/reference only — never needed to insert. */
  assistant_message_id?: string;
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
    assistant_message_id,
  } = input;

  // ⚠️  INVARIANT: The route persists the assistant message before publishing this event.
  //    This function must never call persistChatMessage for the assistant message.
  //    If assistant_message_id is absent the event predates the MODULE 3 patch — that
  //    is fine, we just skip the reference log.
  if (!assistant_message_id) {
    logger.warn('processChatSideEffects: assistant_message_id not in payload (pre-patch event or route bug)', {
      userId,
      sessionId,
    });
  }

  // 1. Student Model Sync Trigger — unchanged
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

  // 2. Session Summarization Trigger — unchanged
  try {
    if (history && history.length > 10 && history.length % 5 === 0) {
      logger.info('SideEffect: chat summary due', { sessionId, messageCount: history.length });
    }
  } catch (err) {
    logger.warn('SideEffect: Summarization trigger failed', err);
  }

  // 3. Semantic Memory Storage — unchanged
  try {
    const memSvc = new ChatMemoryService();
    await memSvc.storeMessageInMemory(userId, message);
  } catch (err) {
    captureSentryException(err, { tags: { context: 'semantic_memory_storage' } });
  }

  // 4. Emotion State Update — unchanged
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

  // 5. Downstream Event Derivation (MIND_TUTOR_COMPLETED) — unchanged
  try {
    const sessionSubject = mindContext?.currentTopic?.subject || mindContext?.weakConcepts?.[0]?.subject;
    const sessionChapter = mindContext?.currentTopic?.chapter || mindContext?.weakConcepts?.[0]?.chapter;

    if (sessionSubject && sessionChapter && sessionSubject !== 'General') {
      const messageCount = history?.length || 1;
      const estimatedMinutes = Math.max(5, Math.round(messageCount * 1.5));
      const isSessionComplete = sessionTurnsCount
        ? sessionTurnsCount >= 6
        : history && history.length >= 10;

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
          intent: intent.intent,
        },
        metadata: { source: 'chat' },
        idempotency_key: `session:${userId}:${sessionSubject}:${sessionChapter}:${new Date().toISOString().slice(0, 16)}`,
      });
    }
  } catch (err) {
    captureSentryException(err, { tags: { context: 'event_publishing' } });
  }
}
