import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { commitBudgetUsage, releaseBudgetReservation } from '@/lib/ai/cost-guard';
import { persistChatMessage } from '@/lib/services/chat-persistence';
import { runMindTurn } from '@/lib/mind/runMindTurn';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { applyResponseClaimGuard } from '@/lib/agent/guardrails/responseClaimGuard';
import type { MutationSummary, VerificationResult } from '@/lib/agent/types';

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
  /**
   * Turn status to persist on the assistant message.
   * Defaults to 'assistant_saved' (success path).
   * Pass 'failed_provider' or 'failed_internal' when finalizing an error turn.
   */
  turnStatus?: 'assistant_saved' | 'failed_provider' | 'failed_internal' | 'completed';
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
      turnStatus?: string;
    }
  ) => Promise<{ id: string; existed?: boolean }>;
  publishEvent?: (event: any) => Promise<string | null>;
  commitBudget?: (reservationId: string, usage: any) => Promise<void>;
  releaseBudget?: (reservationId: string, reason: string) => Promise<void>;
}

export interface ChatTurnFinalizerResult {
  assistantMessageId: string;
  eventId: string | null;
  assistantAlreadyExisted: boolean;
  /** Learner-visible summary of what this turn produced. Empty if nothing durable was produced. */
  learningSignalSummary: string;
  /** The only assistant text safe to persist or send to the learner. */
  assistantText: string;
}

const EMPTY_MUTATION_SUMMARY: MutationSummary = {
  changed: false,
  eventsWritten: 0,
  conceptsCreated: 0,
  conceptsUpdated: 0,
  revisionCardsCreated: 0,
  microtargetsUpdated: 0,
  practiceAttemptsProcessed: 0,
  sessionsCompleted: 0,
  mistakesRecorded: 0,
  warnings: [],
};

const FAILED_VERIFICATION: VerificationResult = {
  ok: false,
  checks: [],
  warnings: ['Learner-state verification did not complete.'],
  errors: [],
};

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
    return EventDispatcher.publish(event);
  });
  const commitBudget = input.commitBudget ?? commitBudgetUsage;
  const releaseBudget = input.releaseBudget ?? releaseBudgetReservation;

  let persistedAssistant: { id: string; existed?: boolean };
  let learningSignalSummary = '';
  let visibleAssistantText = cleanAssistantText;

  // Resolve and verify learner-state mutations before the response becomes visible.
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
    visibleAssistantText = mindResult.runtime.finalResponse?.trim() || cleanAssistantText;
  } catch (ltErr) {
    const errorStr = ltErr instanceof Error
      ? ltErr.message
      : typeof ltErr === 'object' && ltErr !== null
        ? JSON.stringify(ltErr, Object.getOwnPropertyNames(ltErr))
        : String(ltErr);
    logger.warn('MIND chat turn failed before response delivery', {
      userId: input.userId,
      requestId,
      error: errorStr,
    });
    visibleAssistantText = applyResponseClaimGuard(
      cleanAssistantText,
      EMPTY_MUTATION_SUMMARY,
      FAILED_VERIFICATION
    ).filteredResponse || cleanAssistantText;
  }

  try {
    persistedAssistant = await persistAssistantMessage(input.supabase, {
      sessionId: input.sessionId,
      userId: input.userId,
      role: 'assistant',
      content: visibleAssistantText,
      metadata: input.metadata ?? {},
      intent: typeof input.intent === 'string' ? input.intent : input.intent?.intent,
      emotionalState: input.emotion,
      promptVersion: input.promptVersion,
      idempotencyKey: assistantIdempotencyKey,
      turnStatus: input.turnStatus ?? 'assistant_saved',
    });
  } catch (error) {
    // Mark the user message as provider-failed so the UI can show retry (best-effort)
    if (input.userMessageId) {
      try {
        await input.supabase
          .from('chat_messages')
          .update({ turn_status: 'failed_provider' })
          .eq('id', input.userMessageId);
      } catch {
        // non-blocking — ignore errors updating user message status
      }
    }
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

  let eventId: string | null = null;
  try {
    eventId = await publishEvent({
      user_id: input.userId,
      type: 'CHAT_MESSAGE_PROCESSED',
      data: {
        sessionId: input.sessionId,
        message: input.userMessage,
        fullResponse: visibleAssistantText,
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
  } catch (publishErr) {
    logger.error('finalizeChatTurn: event publishing failed', publishErr, {
      userId: input.userId,
      requestId,
    });
  }

  return {
    assistantMessageId: persistedAssistant.id,
    eventId,
    assistantAlreadyExisted,
    learningSignalSummary,
    assistantText: visibleAssistantText,
  };
}
