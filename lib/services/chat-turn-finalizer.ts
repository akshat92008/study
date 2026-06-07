import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { commitBudgetUsage, releaseBudgetReservation } from '@/lib/ai/cost-guard';
import { persistChatMessage } from '@/lib/services/chat-persistence';
import { runMindTurn } from '@/lib/mind/runMindTurn';

export interface ChatTurnFinalizerInput {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  userMessage: string;
  userMessageId?: string;
  assistantText: string;
  intent: any;
  metadata?: any;
  sourceType?: string;
  goalId?: string | null;
  idempotencyKey: string;
  promptVersion?: string;
  recentHistory?: any[];
  sessionTurnsCount?: number;
  mindContext?: any;
  emotion?: string;
  budgetReservationId?: string | null;
  budgetUsage?: any;
  onBehalfOf?: string;
  onBudgetSettled?: (usage: any) => void;
  persistAssistantMessage?: (
    supabase: SupabaseClient,
    message: {
      sessionId: string;
      userId: string;
      role: 'assistant';
      content: string;
      metadata?: Record<string, any>;
      intent?: string;
      emotionalState?: string;
      promptVersion?: string;
      idempotencyKey: string;
    }
  ) => Promise<{ id: string; existed?: boolean }>;
  publishEvent?: (event: Record<string, any>) => Promise<string | null>;
  commitBudget?: (reservationId: string, usage: any) => Promise<void>;
  releaseBudget?: (reservationId: string, reason: string) => Promise<void>;
}

export interface ChatTurnFinalizerResult {
  assistantMessageId: string;
  eventId: string | null;
  assistantAlreadyExisted: boolean;
  /** Learner-visible summary of what this turn produced. Empty if nothing durable was produced. */
  learningSignalSummary: string;
}

/**
 * CHAT TURN FINALIZER
 * ====================
 * Single entry-point for all post-assistant-response side effects.
 * 1. Resolves learning signals from user/assistant turn.
 * 2. Ingests signals to durable event queue.
 * 3. Commits AI budget for the turn.
 * 
 * Safety: learning-signal extraction is best effort, but core persistence,
 * budget settlement, and event publication must be explicit and idempotent.
 */
export async function finalizeChatTurn(input: ChatTurnFinalizerInput): Promise<ChatTurnFinalizerResult> {
  const requestId = input.idempotencyKey;
  const assistantIdempotencyKey = `${requestId}:assistant`;
  const processedEventKey = `${requestId}:chat-message-processed`;
  const cleanAssistantText = input.assistantText
    .replace(/\n\n===METADATA===\n[\s\S]*$/, '')
    .replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '')
    .trim();

  const persistAssistantMessage = input.persistAssistantMessage ?? (async (supabase, message) => persistChatMessage(supabase, message));
  const publishEvent = input.publishEvent ?? (async (event) => {
    const { data, error } = await input.supabase.rpc('publish_event_with_consumers', {
      p_user_id: event.user_id,
      p_type: event.type,
      p_data: event.data,
      p_metadata: event.metadata,
      p_idempotency_key: event.idempotency_key,
    });
    if (error) throw error;
    return data ?? null;
  });
  const commitBudget = input.commitBudget ?? commitBudgetUsage;
  const releaseBudget = input.releaseBudget ?? releaseBudgetReservation;

  let persistedAssistant: { id: string; existed?: boolean };

  try {
    persistedAssistant = await persistAssistantMessage(input.supabase, {
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'assistant',
      content: cleanAssistantText,
      metadata: input.metadata ?? {},
      intent: typeof input.intent === 'string' ? input.intent : input.intent?.intent,
      emotionalState: input.emotion,
      promptVersion: input.promptVersion,
      idempotencyKey: assistantIdempotencyKey,
    });
  } catch (error) {
    if (input.budgetReservationId) {
      await releaseBudget(input.budgetReservationId, error instanceof Error ? error.message : 'assistant_persistence_failed');
    }
    throw error;
  }

  const assistantAlreadyExisted = Boolean(persistedAssistant.existed);
  if (input.budgetReservationId) {
    if (assistantAlreadyExisted) {
      await releaseBudget(input.budgetReservationId, 'duplicate_chat_turn');
    } else if (input.budgetUsage) {
      await commitBudget(input.budgetReservationId, input.budgetUsage);
      input.onBudgetSettled?.(input.budgetUsage);
    } else {
      await releaseBudget(input.budgetReservationId, 'missing_chat_budget_usage');
    }
  }

  // Structured MIND turn: source grounding, weak-area detection, and durable state updates.
  let learningSignalSummary = '';
  try {
    const mindResult = await runMindTurn({
      supabase: input.supabase,
      userId: input.userId,
      sessionId: input.sessionId,
      conversationId: input.sessionId,
      goalId: input.goalId ?? null,
      userMessage: input.userMessage,
      assistantText: cleanAssistantText,
      retrievedChunks: input.metadata?.ragChunks || [],
      metadata: input.metadata ?? {},
      idempotencyKey: `mind_chat:${requestId}`,
    });
    learningSignalSummary = mindResult.learningSignalSummary;
  } catch (ltErr) {
    logger.warn('MIND chat turn failed (non-blocking)', {
      userId: input.userId,
      requestId,
      error: ltErr instanceof Error ? ltErr.message : String(ltErr),
    });
  }

  const eventId = await publishEvent({
    user_id: input.userId,
    type: 'CHAT_MESSAGE_PROCESSED',
    data: {
      sessionId: input.sessionId,
      message: input.userMessage,
      fullResponse: cleanAssistantText,
      emotion: input.emotion,
      history: input.recentHistory,
      sessionTurnsCount: input.sessionTurnsCount,
      mindContext: input.mindContext,
      intent: input.intent,
      metadataPayload: input.metadata ?? {},
      source_type: input.sourceType ?? 'global_chat',
      user_message_id: input.userMessageId,
      assistant_message_id: persistedAssistant.id,
    },
    metadata: {
      requestId,
      source: 'chat_finalizer',
      goalId: input.goalId,
      promptVersion: input.promptVersion,
    },
    idempotency_key: processedEventKey,
  });

  return {
    assistantMessageId: persistedAssistant.id,
    eventId,
    assistantAlreadyExisted,
    learningSignalSummary,
  };
}
