import { EventDispatcher } from '@/lib/events/orchestrator';
import { trackDailyAIUsage } from '@/lib/services/ai-usage.service';
import { persistChatMessage, stripMetadataBlock } from '@/lib/services/chat-persistence';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export class ChatSideEffectService {
  static async finalizeChatResponse({
    supabase,
    userId,
    sessionId,
    message,
    fullResponse,
    intent,
    emotion,
    metadataPayload,
    recentHistory,
    sessionTurnsCount,
    mindContext
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
  }) {
    if (!message) return;

    try {
      const persistedResponse = stripMetadataBlock(fullResponse);
      
      await persistChatMessage(supabase, {
        sessionId,
        userId,
        role: 'assistant',
        content: persistedResponse,
        intent: intent.intent,
        emotionalState: emotion,
        metadata: metadataPayload ?? {},
      });

      await trackDailyAIUsage({
        userId,
        kind: 'chat',
        route: '/api/ai/chat',
        model: 'router:chat',
        promptTokens: Math.ceil(message.length / 4),
        completionTokens: Math.ceil(persistedResponse.length / 4),
      });

      await EventDispatcher.publish({
        user_id: userId,
        type: 'CHAT_MESSAGE_PROCESSED',
        data: {
          sessionId,
          message,
          fullResponse,
          emotion,
          history: recentHistory,
          sessionTurnsCount,
          mindContext,
          intent
        },
        idempotency_key: crypto.randomUUID()
      }).catch(err => logger.error('Failed to enqueue CHAT_MESSAGE_PROCESSED event', err));
      
    } catch (err) {
      logger.error('Failed to finalize chat response side effects', err);
    }
  }
}
