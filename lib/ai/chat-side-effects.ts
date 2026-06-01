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
//   ✗  usage tracking      (route owns reservation, commit, and release)

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { captureSentryException } from '@/lib/telemetry/sentry-runtime';
import { publishTutorProgressEvents } from '@/lib/mind/tutor-completion';

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
  user_message_id?: string;
  source_type?: string;
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
    user_message_id,
    source_type,
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
    const episodeSvc = new EpisodicMemoryService();
    await memSvc.storeConversationTurnInMemory(userId, {
      sourceType: (source_type as any) || 'global_chat',
      sessionId,
      userMessageId: user_message_id,
      assistantMessageId: assistant_message_id,
      userMessage: message,
      assistantMessage: fullResponse,
    });
    await episodeSvc.writeEpisode({
      userId,
      text: message,
      sourceType: (source_type as any) || 'global_chat',
      sourceId: user_message_id,
      metadata: { sessionId, intent: intent?.intent },
    });
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

  // 5. Downstream Event Derivation (MIND_TUTOR_COMPLETED + concept expansion)
  try {
    const significantModelSignal =
      emotion && emotion !== 'neutral' ||
      ['TUTOR_SESSION', 'PRACTICE', 'REPLAN'].includes(intent?.intent) ||
      /\b(stuck|confused|burnt out|overwhelmed|deadline|goal|mock|mistake)\b/i.test(message);

    if (significantModelSignal) {
      const { EventDispatcher } = await import('@/lib/events/orchestrator');
      await Promise.resolve(EventDispatcher.publish({
        user_id: userId,
        type: 'STUDENT_MODEL_SYNC_REQUESTED',
        data: {
          reason: 'intra_session_signal',
          sessionId,
          emotion,
          intent: intent?.intent,
        },
        metadata: { source: source_type || 'global_chat' },
        idempotency_key: `student_model_sync:${userId}:${sessionId}:${assistant_message_id || user_message_id || Date.now()}`,
      })).catch((err: Error) =>
        logger.warn('SideEffect: model sync event publish failed', { userId, err })
      );
    }

    await publishTutorProgressEvents({
      userId,
      sessionId,
      message,
      fullResponse,
      history,
      sessionTurnsCount,
      mindContext,
      intent,
      emotion,
      sourceType: source_type || 'global_chat',
      assistantMessageId: assistant_message_id,
      userMessageId: user_message_id,
    });
  } catch (err) {
    captureSentryException(err, { tags: { context: 'event_publishing' } });
  }
}
