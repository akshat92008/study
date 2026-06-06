import { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';
import { 
  reserveBudgetForModelCall, 
  commitBudgetUsage, 
  releaseBudgetReservation 
} from '@/lib/ai/cost-guard';
import { captureSentryException } from '@/lib/telemetry/sentry-runtime';

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
}

/**
 * CHAT TURN FINALIZER
 * ====================
 * Single entry-point for all post-assistant-response side effects.
 * 1. Resolves learning signals from user/assistant turn.
 * 2. Ingests signals to durable event queue.
 * 3. Commits AI budget for the turn.
 * 
 * Safety: Failures in side-effects MUST NOT kill the assistant response stream.
 * They are wrapped in a top-level try/catch and logged/traced.
 */
export async function finalizeChatTurn(input: ChatTurnFinalizerInput): Promise<void> {
  let budgetReservationId: string | null = null;
  const requestId = input.idempotencyKey;

  try {
    // 1. Extract Signals
    const cleanAssistantText = input.assistantText
      .replace(/\n\n===METADATA===\n[\s\S]*$/, '')
      .replace(/\[ACTION:OPEN_DRAWER:\w+\]/g, '')
      .trim();

    const detectedSubject = input.intent?.subject ?? input.metadata?.subject ?? null;
    const detectedChapter = input.intent?.chapter ?? input.metadata?.chapter ?? null;
    const detectedTopic = input.intent?.topic ?? input.metadata?.topic ?? null;
    const intentStr = typeof input.intent === 'string' ? input.intent : input.intent?.intent;

    if (detectedSubject || detectedChapter || detectedTopic || intentStr === 'MISTAKE_ADMITTED' || intentStr === 'CONCEPT_CONFUSION') {
      const signalType = inferSignalType(input.userMessage, cleanAssistantText, intentStr);
      if (
        signalType === 'confusion_detected' || 
        signalType === 'doubt_asked' || 
        signalType === 'manual_mistake' || 
        signalType === 'practice_requested' || 
        signalType === 'concept_practiced' ||
        signalType === 'self_reflection'
      ) {
        await ingestLearningSignal(input.supabase, {
          user_id: input.userId,
          goal_id: input.goalId ?? null,
          signal_type: signalType as any,
          source_type: input.sourceType ?? 'global_chat',
          source_id: requestId, // Link to this specific turn
          subject: detectedSubject,
          topic: detectedTopic ?? detectedChapter,
          confidence: signalType === 'confusion_detected' ? 0.68 : 0.58,
          evidence: {
            user_message: input.userMessage,
            assistant_response: cleanAssistantText.slice(0, 1000),
            detected_intent: intentStr,
          },
        });
      }
    }

    // 2. Publish CHAT_MESSAGE_PROCESSED event for background workers
    const { data: eventId, error: eventError } = await input.supabase.rpc('publish_event_with_consumers', {
      p_user_id: input.userId,
      p_type: 'CHAT_MESSAGE_PROCESSED',
      p_data: {
        sessionId: input.sessionId,
        userMessage: input.userMessage,
        assistantText: cleanAssistantText,
        intent: input.intent,
        metadata: input.metadata,
      },
      p_metadata: {
        requestId,
        source: 'chat_finalizer',
        goalId: input.goalId,
      },
      p_idempotency_key: `chat_finalized:${requestId}`,
    });

    if (eventError) {
      logger.warn('Failed to publish CHAT_MESSAGE_PROCESSED', { error: eventError, requestId });
    }

    // 3. Commit AI Budget (if reservation was made in route)
    // Note: The route should have made a reservation. Here we finalize it.
    // If no reservation exists, this is a no-op or creates a direct commit.
    await commitBudgetUsage(requestId, {
      promptTokens: 500, // Reasonable default for commit
      completionTokens: Math.ceil(cleanAssistantText.length / 4),
    }).catch(err => logger.warn('Budget commit failed in finalizer', err));

  } catch (error) {
    captureSentryException(error, {
      tags: { feature: 'chat_finalizer', userId: input.userId },
      extra: { sessionId: input.sessionId, requestId }
    });
    logger.error('FinalizeAssistantTurn failed', error, {
      userId: input.userId,
      sessionId: input.sessionId,
      requestId
    });
  }
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
  return 'explanation_given';
}
