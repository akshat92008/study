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
import { storeMessageCitations } from '@/lib/rag/citations';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';

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
  goalId?: string | null;
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

    await storeMessageCitations({
      supabase: input.supabase,
      userId: input.userId,
      messageId: assistant.id,
      context: input.mindContext?.ragContext,
    }).catch((err) => {
      logger.warn('Chat turn finalization: failed to store RAG citations', {
        userId: input.userId,
        messageId: assistant.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    const eventId = await publishEvent({
      user_id: input.userId,
      type: 'CHAT_MESSAGE_PROCESSED',
      source: input.sourceType ?? 'global_chat',
      data: {
        sessionId: input.sessionId,
        chatSessionId: input.sessionId,
        goalId: input.goalId ?? null,
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
          goalId: input.goalId ?? null,
        },
      });

    const detectedSubject = input.intent?.subject ?? input.metadata?.subject ?? null;
    const detectedChapter = input.intent?.chapter ?? input.metadata?.chapter ?? null;
    const detectedTopic = input.intent?.topic ?? input.metadata?.topic ?? null;
    if (detectedSubject || detectedChapter || detectedTopic) {
      const signalType = inferSignalType(input.userMessage, cleanAssistantText);
      if (signalType === 'confusion_detected' || signalType === 'doubt_asked') {
        await ingestLearningSignal(input.supabase, {
          user_id: input.userId,
          goal_id: input.goalId ?? null,
          signal_type: 'chat_confusion',
          source_type: input.sourceType ?? 'global_chat',
          source_id: assistant.id,
          subject: detectedSubject,
          topic: detectedTopic ?? detectedChapter,
          confidence: signalType === 'confusion_detected' ? 0.68 : 0.58,
          evidence: {
            signalType,
            conversationId: input.sessionId,
            userMessagePreview: input.userMessage.slice(0, 600),
          },
        }, {
          publishEvent: false,
          idempotencyKey: `${input.idempotencyKey}:learning-signal-row`,
        }).catch((err) => {
          logger.warn('Chat learning signal persistence failed', {
            userId: input.userId,
            messageId: assistant.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      await publishEvent({
        user_id: input.userId,
        type: 'CHAT_LEARNING_SIGNAL',
        source: input.sourceType ?? 'global_chat',
        data: {
          conversationId: input.sessionId,
          chatSessionId: input.sessionId,
          goalId: input.goalId ?? null,
          messageId: assistant.id,
          detectedSubject,
          detectedChapter,
          detectedTopic,
          signalType,
          confidence: 0.62,
        },
        idempotency_key: `${input.idempotencyKey}:chat-learning-signal`,
        metadata: {
          source: input.sourceType ?? 'global_chat',
          goalId: input.goalId ?? null,
        },
      }).catch((err) => {
        logger.warn('Chat learning signal publish failed', {
          userId: input.userId,
          messageId: assistant.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    logger.info('Chat request completed', { userId: input.userId, feature: 'chat', idempotencyKey: input.idempotencyKey });

    return {
      assistantMessageId: assistant.id,
      eventId,
      assistantAlreadyExisted: Boolean(assistant.existed),
    };
  } catch (error) {
    await releaseBudgetOnce(error instanceof Error ? error.message : 'chat_turn_finalization_failed');
    logger.error('Chat request failed', error, {
      userId: input.userId,
      sessionId: input.sessionId,
      feature: 'chat',
      idempotencyKey: input.idempotencyKey,
    });
    throw error;
  }
}

function inferSignalType(userMessage: string, assistantText: string) {
  if (/\b(confus|stuck|doubt|why|how)\b/i.test(userMessage)) return 'doubt_asked';
  if (/\b(practice|mcq|question|solve)\b/i.test(userMessage)) return 'concept_practiced';
  if (/\b(confus|mistake|stuck)\b/i.test(`${userMessage}\n${assistantText}`)) return 'confusion_detected';
  return 'explanation_given';
}
