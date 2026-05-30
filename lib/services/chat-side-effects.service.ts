// lib/services/chat-side-effects.service.ts
//
// MODULE 3 PATCH: finalizeChatResponse no longer persists the assistant message
// (the route does that and provides assistantMessageId). Budget accounting also
// lives in the route; this service only publishes CHAT_MESSAGE_PROCESSED carrying the stable
// assistant_message_id so the worker never needs to re-insert.

import { EventDispatcher } from '@/lib/events/orchestrator';
import { stripMetadataBlock } from '@/lib/services/chat-persistence';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export class ChatSideEffectService {
  /**
   * Called by the streaming branch of the chat route after:
   *  1. The full response has been collected.
   *  2. The assistant message has been persisted by the route.
   *  3. assistantMessageId holds the canonical DB row id.
   *
   * Responsibilities here:
   *  - Enqueue CHAT_MESSAGE_PROCESSED with assistant_message_id.
   *
   * What this must NOT do:
   *  - Call persistChatMessage — the route already did it.
   */
  static async finalizeChatResponse({
    userId,
    sessionId,
    message,
    fullResponse,
    intent,
    emotion,
    metadataPayload,
    recentHistory,
    sessionTurnsCount,
    mindContext,
    assistantMessageId,
  }: {
    supabase: SupabaseClient;
    userId: string;
    sessionId: string;
    message: string;
    fullResponse: string;
    intent: any;
    emotion: string;
    metadataPayload?: any;
    recentHistory: any[];
    sessionTurnsCount?: number;
    mindContext: any;
    /** ID of the already-persisted assistant chat_messages row.
     *  Required. If absent the route has a bug; we log but continue. */
    assistantMessageId: string;
  }) {
    if (!message) return;

    try {
      const cleanResponse = stripMetadataBlock(fullResponse);

      // Publish the side-effect event. The worker will use assistant_message_id
      // as a reference and must NOT create another chat_messages row.
      await EventDispatcher.publish({
        user_id: userId,
        type: 'CHAT_MESSAGE_PROCESSED',
        data: {
          sessionId,
          message,
          fullResponse: cleanResponse,
          emotion,
          history: recentHistory,
          sessionTurnsCount,
          mindContext,
          intent,
          metadataPayload,
          // ── CRITICAL: tells the worker the message is already in the DB ──
          assistant_message_id: assistantMessageId,
        },
        idempotency_key: crypto.randomUUID(),
      }).catch((err: Error) =>
        logger.error('finalizeChatResponse: failed to enqueue CHAT_MESSAGE_PROCESSED', err)
      );

    } catch (err) {
      logger.error('finalizeChatResponse: unexpected error in side-effect finalization', err);
    }
  }
}
