import { ChatTutorService } from '@/lib/services/chat-tutor.service';
import { ChatPlannerService } from '@/lib/services/chat-planner.service';
import { budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { sanitizeHistoryForPrompt } from '@/lib/ai/chat-history-sanitizer';
import { maybeUpdateSessionSummary } from '@/lib/ai/session-summary';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { logger } from '@/lib/utils/logger';
import { isBudgetExceeded, isBudgetUnavailable, budgetExceededResponse, budgetUnavailableResponse } from '@/lib/ai/cost-guard';
import { reserveUsage, commitUsage, releaseUsage } from '@/lib/usage/enforce-feature-limit';

export async function handleMainStreaming({
  userId,
  sessionId,
  message,
  recentHistory,
  intent,
  orchestratorResult,
  systemPrompt,
  isSimpleMessage,
  sessionTurnsCount,
  mindContext,
  crossSessionMemories,
  finalizeAssistantTurn,
  encoder,
}: {
  userId: string;
  sessionId: string;
  message: string;
  recentHistory: any[];
  intent: any;
  orchestratorResult: any;
  systemPrompt: string;
  isSimpleMessage: boolean;
  sessionTurnsCount: number;
  mindContext: any;
  crossSessionMemories: string[];
  finalizeAssistantTurn: any;
  encoder: TextEncoder;
  supabase: any;
}): Promise<Response> {
  let mainGenerator: AsyncGenerator<string> | null = null;
  
  if (intent.intent !== 'TUTOR_SESSION' && intent.intent !== 'PRACTICE' && intent.intent !== 'REPLAN' && intent.intent !== 'CREATE_ARTIFACT' && orchestratorResult.intent !== 'planning') {
    // Phase 6.3 — Reserve AI usage BEFORE the expensive provider call.
    // This is a best-effort guard: if reservation fails we proceed (fail-open for UX),
    // but we log. The budgetedStreamGeneration has its own cost-guard as a second line.
    let aiReservationId: string | null = null;
    try {
      aiReservationId = await import('@/lib/usage/enforce-feature-limit')
        .then(m => m.reserveUsage(userId, 'ai_call', 1, { idempotencyKey: `stream:${sessionId}:${Date.now()}` }))
        .catch(err => {
          logger.warn('[streaming] AI usage reservation failed, proceeding fail-open', { userId, error: err?.message });
          return null;
        });
    } catch { /* non-blocking */ }

    try {
      const { getMaxRecentMessages } = await import('@/lib/ai/cost-mode');
      const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), message || '');
      void maybeUpdateSessionSummary(userId, sessionId, recentHistory).catch(() => {});

      const conversationMessages = buildConversationMessages(sanitizedHistory, message || '');
      mainGenerator = await budgetedStreamGeneration({
        userId,
        feature: 'chat',
        route: '/api/ai/chat',
        model: isSimpleMessage ? 'flash' : 'pro',
        systemPrompt,
        userPrompt: conversationMessages,
      });
      // Commit reservation immediately since the generator is ready (streaming started)
      if (aiReservationId) {
        commitUsage(aiReservationId, {}).catch(err =>
          logger.warn('[streaming] Failed to commit AI usage reservation', { userId, aiReservationId, error: err?.message })
        );
      }
    } catch (err) {
      // Release reservation on provider failure
      if (aiReservationId) {
        releaseUsage(aiReservationId, {}).catch(() => {});
      }
      if (isBudgetExceeded(err)) return budgetExceededResponse();
      if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
      
      logger.error('Main AI generation failed', err);
      const fallbackStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("I could not generate that part right now. Try again in a moment."));
          controller.close();
        }
      });
      return new Response(fallbackStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;

      try {
        const { getMaxRecentMessages } = await import('@/lib/ai/cost-mode');
        const supabaseObj = (await import('@/lib/supabase/server')).createClient();

        if (intent.intent === 'TUTOR_SESSION' || intent.intent === 'PRACTICE') {
          const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), message || '');
          void maybeUpdateSessionSummary(userId, sessionId, recentHistory).catch(() => {});

          const tutorResult = await ChatTutorService.handleTutorSession(
            await supabaseObj,
            userId,
            intent,
            mindContext,
            systemPrompt,
            sanitizedHistory,
            message || '',
            sessionTurnsCount,
            controller,
            encoder
          );
          fullResponse = tutorResult.fullResponse;
          metadataPayload = tutorResult.metadataPayload;
        } else if (intent.intent === 'REPLAN') {
          const replanResult = await ChatPlannerService.handleReplan(
            await supabaseObj, userId, intent.action || 'reduce_tasks', controller, encoder
          );
          fullResponse = replanResult.fullResponse;
          metadataPayload = replanResult.metadataPayload;
        } else if (intent.intent === 'CREATE_ARTIFACT' || orchestratorResult.intent === 'planning') {
          const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), message || '');
          void maybeUpdateSessionSummary(userId, sessionId, recentHistory).catch(() => {});

          const artifactResult = await ChatPlannerService.handleCreateArtifact(
            await supabaseObj, userId, systemPrompt, sanitizedHistory, message || '', controller, encoder
          );
          fullResponse = artifactResult.fullResponse;
          metadataPayload = artifactResult.metadataPayload;
        } else if (mainGenerator) {
          for await (const chunk of mainGenerator) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
        }

        const contextTrace = {
          learner_state_version: mindContext?.profile?.learnerStateVersion || 0,
          memory_count: crossSessionMemories.length,
          weak_concept_count: mindContext?.weakConcepts?.length || 0,
          due_card_count: mindContext?.overdueCardsCount || 0,
          mistake_count: mindContext?.recentMistakes?.length || 0,
          rag_grounded: Boolean(mindContext?.ragContext?.grounded),
          rag_chunk_count: mindContext?.ragContext?.chunks?.length || 0,
          rag_material_ids: mindContext?.ragContext?.materialIds || [],
          rag_chunk_ids: mindContext?.ragContext?.chunkIds || [],
        };
        metadataPayload = { ...(metadataPayload || {}), contextTrace };

        if (metadataPayload) {
          controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
        }

        const { looksTruncated } = await import('@/lib/utils/text-completeness');
        if (looksTruncated(fullResponse)) {
          const truncationHint = '\n\n*The response may be incomplete. Say "continue" and I will finish it.*';
          controller.enqueue(encoder.encode(truncationHint));
          fullResponse += truncationHint;
        }

        await finalizeAssistantTurn({
          assistantText: fullResponse,
          intent,
          metadata: metadataPayload ?? {},
          budgetReservationId: null,
        });

      } catch (err: any) {
        logger.error('Chat stream error', err);
        controller.enqueue(encoder.encode('\
\
I could not generate that part right now. Try again in a moment.'));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache',
    }
  });
}
