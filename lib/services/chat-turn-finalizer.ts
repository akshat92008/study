import { EventDispatcher } from '@/lib/events/orchestrator';
import {
  persistChatMessage,
  stripMetadataBlock,
} from '@/lib/services/chat-persistence';
import {
  commitBudgetUsage,
  releaseBudgetReservation,
} from '@/lib/ai/cost-guard';
import { logger } from '@/lib/utils/logger';

type BudgetUsage = {
  promptTokens: number;
  completionTokens: number;
  route: string;
  promptVersion?: string;
  promptFamily?: string;
  promptSource?: string;
};

type PersistAssistantMessage = typeof persistChatMessage;
type PublishEvent = typeof EventDispatcher.publish;

export type FinalizeChatTurnInput = {
  supabase: any;
  userId: string;
  sessionId: string;
  userMessage: string;
  userMessageId?: string;
  assistantText: string;
  metadata?: Record<string, any> | null;
  intent?: any;
  emotion?: string;
  promptVersion?: string;
  idempotencyKey: string;
  recentHistory?: any[];
  sessionTurnsCount?: number;
  mindContext?: any;
  budgetReservationId?: string | null;
  budgetUsage?: BudgetUsage | null;
  sourceType?: string;
  persistAssistantMessage?: PersistAssistantMessage;
  publishEvent?: PublishEvent;
  commitBudget?: typeof commitBudgetUsage;
  releaseBudget?: typeof releaseBudgetReservation;
  onBudgetSettled?: () => void;
};

export type FinalizeChatTurnResult = {
  assistantMessageId: string;
  eventId: string | null;
  assistantAlreadyExisted: boolean;
};

export async function finalizeChatTurn(input: FinalizeChatTurnInput): Promise<FinalizeChatTurnResult> {
  const persistAssistant = input.persistAssistantMessage ?? persistChatMessage;
  const publishEvent = input.publishEvent ?? EventDispatcher.publish;
  const commitBudget = input.commitBudget ?? commitBudgetUsage;
  const releaseBudget = input.releaseBudget ?? releaseBudgetReservation;
  const cleanAssistantText = stripMetadataBlock(input.assistantText);
  const assistantIdempotencyKey = `${input.idempotencyKey}:assistant`;
  const eventIdempotencyKey = `${input.idempotencyKey}:chat-message-processed`;
  let budgetSettled = false;

  const markBudgetSettled = () => {
    if (budgetSettled) return;
    budgetSettled = true;
    input.onBudgetSettled?.();
  };

  const releaseBudgetOnce = async (reason: string) => {
    if (!input.budgetReservationId || budgetSettled) return;
    await releaseBudget(input.budgetReservationId, reason);
    markBudgetSettled();
  };

  try {
    const assistant = await persistAssistant(input.supabase, {
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'assistant',
      content: cleanAssistantText,
      intent: typeof input.intent === 'string' ? input.intent : input.intent?.intent,
      emotionalState: input.emotion ?? 'neutral',
      metadata: input.metadata ?? {},
      promptVersion: input.promptVersion,
      idempotencyKey: assistantIdempotencyKey,
    });

    if (input.budgetReservationId) {
      if (assistant.existed) {
        await releaseBudgetOnce('duplicate_chat_turn');
      } else if (input.budgetUsage) {
        await commitBudget(input.budgetReservationId, input.budgetUsage);
        markBudgetSettled();
      } else {
        await releaseBudgetOnce('missing_chat_budget_usage');
      }
    }

    const eventId = await publishEvent({
      user_id: input.userId,
      type: 'CHAT_MESSAGE_PROCESSED',
      source: input.sourceType ?? 'global_chat',
      data: {
        sessionId: input.sessionId,
        message: input.userMessage,
        fullResponse: cleanAssistantText,
        emotion: input.emotion ?? 'neutral',
        history: input.recentHistory ?? [],
        sessionTurnsCount: input.sessionTurnsCount ?? 0,
        mindContext: input.mindContext ?? null,
        intent: input.intent ?? { intent: 'GENERAL_CHAT' },
        metadataPayload: input.metadata ?? undefined,
        source_type: input.sourceType ?? 'global_chat',
        user_message_id: input.userMessageId,
        assistant_message_id: assistant.id,
      },
      idempotency_key: eventIdempotencyKey,
      metadata: {
        source: input.sourceType ?? 'global_chat',
      },
    });

    return {
      assistantMessageId: assistant.id,
      eventId,
      assistantAlreadyExisted: Boolean(assistant.existed),
    };
  } catch (error) {
    await releaseBudgetOnce(error instanceof Error ? error.message : 'chat_turn_finalization_failed');
    logger.error('Chat turn finalization failed', error, {
      userId: input.userId,
      sessionId: input.sessionId,
      feature: 'chat-turn-finalizer',
    });
    throw error;
  }
}
