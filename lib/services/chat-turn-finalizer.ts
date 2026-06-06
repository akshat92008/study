import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';
import { commitBudgetUsage, releaseBudgetReservation } from '@/lib/ai/cost-guard';
import { persistChatMessage } from '@/lib/services/chat-persistence';
import { captureSentryException } from '@/lib/telemetry/sentry-runtime';
import { upsertMistakeRisk } from '@/lib/services/repair-loop.service';
import { processLearningTransaction } from '@/lib/learning/learning-transaction';

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
  /** Learner-visible summary of what this turn produced (e.g. '2 weak signals logged · 1 retest scheduled'). Empty if nothing durable was produced. */
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

  // Learning signals are stateful but non-blocking. The assistant response has
  // already been persisted; event publication below remains the hard boundary.
  try {
    const detectedSubject = input.intent?.subject ?? input.metadata?.subject ?? null;
    const detectedChapter = input.intent?.chapter ?? input.metadata?.chapter ?? null;
    const detectedTopic = input.intent?.topic ?? input.metadata?.topic ?? null;
    const intentStr = typeof input.intent === 'string' ? input.intent : input.intent?.intent;

    const signalType = inferSignalType(input.userMessage, cleanAssistantText, intentStr);

    // Always ingest — chat_confusion is now the valid fallback type (fixed BUG 1)
    await ingestLearningSignal(input.supabase, {
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      signal_type: signalType as any,
      source_type: input.sourceType ?? 'global_chat',
      source_id: input.userMessageId ?? null,
      subject: detectedSubject,
      topic: detectedTopic ?? detectedChapter,
      confidence: signalType === 'confusion_detected' ? 0.68 : signalType === 'doubt_asked' ? 0.65 : 0.55,
      evidence: {
        user_message: input.userMessage,
        assistant_response: cleanAssistantText.slice(0, 1000),
        detected_intent: intentStr,
        assistant_message_id: persistedAssistant.id,
      },
    }, { idempotencyKey: `chat_signal:${requestId}:${signalType}` });

    const explicitMistake = extractExplicitChatMistake(input.userMessage);
    if (explicitMistake && (signalType === 'manual_mistake' || signalType === 'confusion_detected')) {
      await upsertMistakeRisk(input.supabase, {
        userId: input.userId,
        goalId: input.goalId ?? null,
        source: 'chat',
        subject: detectedSubject,
        topic: detectedTopic ?? detectedChapter ?? explicitMistake.concept,
        chapter: detectedChapter ?? detectedTopic ?? null,
        concept: explicitMistake.concept || detectedTopic || detectedChapter || 'Chat-detected mistake',
        mistakeText: explicitMistake.mistakeText,
        correctAnswer: explicitMistake.correctAnswer,
        whyWrong: 'The learner explicitly admitted this confusion in chat.',
        examTrap: 'MIND should clear this repair before moving too far into unrelated study.',
        severity: 2,
        category: 'conceptual_gap',
        sourceId: input.userMessageId ?? persistedAssistant.id,
        metadata: {
          userMessage: input.userMessage.slice(0, 1200),
          assistantMessageId: persistedAssistant.id,
        },
      });
    }
  } catch (error) {
    captureSentryException(error, {
      tags: { feature: 'chat_finalizer', userId: input.userId },
      extra: { sessionId: input.sessionId, requestId }
    });
    logger.warn('Chat learning-signal persistence failed', {
      userId: input.userId,
      sessionId: input.sessionId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Learning transaction: structured weak-area + concept detection ─────────
  // Runs after signal ingest. Non-blocking: failures do not affect message delivery.
  let learningSignalSummary = '';
  try {
    const txResult = await processLearningTransaction({
      supabase: input.supabase,
      userId: input.userId,
      source: 'typed_doubt',
      idempotencyKey: `lt_chat:${requestId}`,
      sessionId: input.sessionId,
      goalId: input.goalId ?? null,
      userText: input.userMessage,
      assistantText: cleanAssistantText,
    });
    learningSignalSummary = txResult.learningSignalSummary;
  } catch (ltErr) {
    logger.warn('Chat learning transaction failed (non-blocking)', {
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

function extractExplicitChatMistake(userMessage: string): { concept: string | null; mistakeText: string; correctAnswer?: string | null } | null {
  const text = userMessage.trim();
  if (text.length < 12) return null;
  if (!/\b(my mistake|i got .*wrong|i answered .*wrong|wrong answer|i chose|i picked|i thought)\b/i.test(text)) {
    return null;
  }

  const correctMatch = text.match(/\b(correct answer|answer should be|it should be)\s*[:=-]?\s*([^.;\n]{2,120})/i);
  const conceptMatch = text.match(/\b(?:in|for|on)\s+([a-z0-9 ,:/()-]{3,80})\b/i);
  return {
    concept: conceptMatch?.[1]?.trim() ?? null,
    mistakeText: text.slice(0, 1000),
    correctAnswer: correctMatch?.[2]?.trim() ?? null,
  };
}

function inferSignalType(userMessage: string, assistantText: string, intentStr?: string) {
  if (intentStr === 'REMEMBER_THIS') return 'self_reflection';
  if (intentStr === 'MISTAKE_ADMITTED') return 'manual_mistake';
  if (intentStr === 'CONCEPT_CONFUSION') return 'confusion_detected';
  if (intentStr === 'DOUBT_ASKED' || intentStr === 'SOURCE_GROUNDED_QUERY') return 'doubt_asked';
  if (intentStr === 'PRACTICE_REQUESTED') return 'practice_requested';
  if (intentStr === 'PRACTICE_ATTEMPT_SUBMITTED' || intentStr === 'ANSWER_CHECK_REQUESTED') return 'concept_practiced';
  
  // Fallback to legacy regex checks if intent mapping didn't catch it
  if (/\b(confus|stuck|doubt|why|how)\b/i.test(userMessage)) return 'doubt_asked';
  if (/\b(practice|mcq|question|solve)\b/i.test(userMessage)) return 'concept_practiced';
  if (/\b(confus|mistake|stuck)\b/i.test(`${userMessage}\n${assistantText}`)) return 'confusion_detected';
  return 'chat_confusion';
}
