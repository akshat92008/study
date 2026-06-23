import { ChatTutorService } from '@/lib/services/chat-tutor.service';
import { ChatPlannerService } from '@/lib/services/chat-planner.service';
import { budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { sanitizeHistoryForPrompt } from '@/lib/ai/chat-history-sanitizer';
import { maybeUpdateSessionSummary } from '@/lib/ai/session-summary';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { logger } from '@/lib/utils/logger';
import { isBudgetExceeded, isBudgetUnavailable, budgetExceededResponse, budgetUnavailableResponse } from '@/lib/ai/cost-guard';
import { reserveUsage, commitUsage, releaseUsage, featureLimitResponse } from '@/lib/usage/enforce-feature-limit';

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
  let aiReservationId: string | null = null;
  
  if (intent.intent !== 'TUTOR_SESSION' && intent.intent !== 'PRACTICE' && intent.intent !== 'REPLAN' && intent.intent !== 'CREATE_ARTIFACT' && orchestratorResult.intent !== 'planning') {

    try {
      const { getMaxRecentMessages } = await import('@/lib/ai/cost-mode');
      const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), message || '');
      void maybeUpdateSessionSummary(userId, sessionId, recentHistory).catch(() => {});

      const conversationMessages = buildConversationMessages(sanitizedHistory, message || '');
      aiReservationId = await reserveUsage(userId, 'ai_call', 1, {
        route: '/api/ai/chat',
        sessionId,
        intent: intent.intent,
      });
      mainGenerator = await budgetedStreamGeneration({
        userId,
        feature: 'chat',
        route: '/api/ai/chat',
        model: isSimpleMessage ? 'flash' : 'pro',
        systemPrompt,
        userPrompt: conversationMessages,
      });
    } catch (err) {
      if (aiReservationId) {
        // Release reservation on provider failure before falling back.
        await releaseUsage(aiReservationId, {
          reason: 'provider_generation_failed',
          error: err instanceof Error ? err.message : String(err),
        }).catch((releaseError) => {
          logger.warn('Failed to release AI usage reservation after provider failure', releaseError);
        });
        aiReservationId = null;
      }

      if ((err as any)?.check) return featureLimitResponse((err as any).check);
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
      const bufferedController = { enqueue: (chunk: Uint8Array) => controller.enqueue(chunk) } as unknown as ReadableStreamDefaultController<Uint8Array>;

      try {
        const { getMaxRecentMessages } = await import('@/lib/ai/cost-mode');
        const supabaseObj = (await import('@/lib/supabase/server')).createClient();

        if (intent.intent === 'TUTOR_SESSION' || intent.intent === 'PRACTICE') {
          const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), message || '');
          void maybeUpdateSessionSummary(userId, sessionId, recentHistory).catch(() => {});

          if (intent.currentMaterialId || (intent.selectedMaterialIds && intent.selectedMaterialIds.length > 0)) {
            const { StudyRoomTutorService } = await import('@/lib/study-room/study-room.service');
            const studyRoomResult = await StudyRoomTutorService.handleMaterialSession({
              supabase: await supabaseObj,
              userId,
              sessionId,
              currentMaterialId: intent.currentMaterialId,
              selectedMaterialIds: intent.selectedMaterialIds,
              currentTopic: intent.currentTopic,
              studyRoomIntent: intent.studyRoomIntent,
              message: message || '',
              recentHistory: sanitizedHistory,
              systemPrompt,
              mindContext,
              controller: bufferedController,
              encoder
            });
            fullResponse = studyRoomResult.fullResponse;
            metadataPayload = studyRoomResult.metadataPayload;
          } else {
            const tutorResult = await ChatTutorService.handleTutorSession(
              await supabaseObj,
              userId,
              intent,
              mindContext,
              systemPrompt,
              sanitizedHistory,
              message || '',
              sessionTurnsCount,
              bufferedController,
              encoder
            );
            fullResponse = tutorResult.fullResponse;
            metadataPayload = tutorResult.metadataPayload;
          }
        } else if (intent.intent === 'REPLAN') {
          const replanResult = await ChatPlannerService.handleReplan(
            await supabaseObj, userId, intent.action || 'reduce_tasks', bufferedController, encoder
          );
          fullResponse = replanResult.fullResponse;
          metadataPayload = replanResult.metadataPayload;
        } else if (intent.intent === 'CREATE_ARTIFACT' || orchestratorResult.intent === 'planning') {
          const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), message || '');
          void maybeUpdateSessionSummary(userId, sessionId, recentHistory).catch(() => {});

          const artifactResult = await ChatPlannerService.handleCreateArtifact(
            await supabaseObj, userId, mindContext, systemPrompt, sanitizedHistory, message || '', bufferedController, encoder
          );
          fullResponse = artifactResult.fullResponse;
          metadataPayload = artifactResult.metadataPayload;
        } else if (mainGenerator) {
          for await (const chunk of mainGenerator) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        if (fullResponse.includes('<artifact type="practice-test"') || fullResponse.includes('<artifact type="mcq-set"') || fullResponse.includes('<artifact type="flashcard-set"')) {
          const { PracticeService } = await import('@/lib/services/practice.service');
          try {
            const extraction = await PracticeService.extractAndStorePracticeArtifacts(await supabaseObj, {
              userId,
              chatSessionId: sessionId,
              goalId: mindContext?.activeGoal?.id ?? null,
              messageId: undefined, // Message is not persisted yet
              fullResponse,
              source: mindContext?.ragContext?.grounded ? 'rag' : 'mind',
              sourceMaterialIds: mindContext?.ragContext?.materialIds,
              sourceChunkIds: mindContext?.ragContext?.chunkIds,
            });
            if (extraction.practiceSetIds.length > 0) {
              metadataPayload = { ...(metadataPayload || {}), practiceSetId: extraction.practiceSetIds[0] };
            } else if (extraction.flashcardSetIds.length > 0) {
              metadataPayload = { ...(metadataPayload || {}), practiceSetId: extraction.flashcardSetIds[0] };
            }
          } catch (e) {
            logger.warn('Failed to synchronously extract practice set', e);
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
          sourcesUsed: mindContext?.ragContext?.sourcesUsed || [],
        };
        metadataPayload = { ...(metadataPayload || {}), contextTrace };

        const { looksTruncated } = await import('@/lib/utils/text-completeness');
        if (looksTruncated(fullResponse)) {
          const truncationHint = '\n\n*The response may be incomplete. Say "continue" and I will finish it.*';
          fullResponse += truncationHint;
          controller.enqueue(encoder.encode(truncationHint));
        }

        const isDegraded = fullResponse.includes('temporarily unavailable') || 
                           fullResponse.includes('at capacity') || 
                           fullResponse.includes('catching up with demand') ||
                           fullResponse.includes('I could not generate that part right now') ||
                           fullResponse.includes('temporarily paused');

        const finalized = await finalizeAssistantTurn({
          assistantText: fullResponse,
          intent,
          metadata: metadataPayload ?? {},
          budgetReservationId: null,
          turnStatus: isDegraded ? 'failed_provider' : 'assistant_saved',
        });
        if (aiReservationId) {
          const reservationToCommit = aiReservationId;
          try {
            await commitUsage(reservationToCommit, {
              route: '/api/ai/chat',
              sessionId,
              intent: intent.intent,
              turnStatus: isDegraded ? 'failed_provider' : 'assistant_saved',
              estimatedCompletionTokens: Math.max(1, Math.ceil(fullResponse.length / 4)),
            });
            aiReservationId = null;
          } catch (commitError) {
            logger.error('Failed to commit AI usage reservation', commitError, {
              userId,
              sessionId,
              reservationId: reservationToCommit,
            });
            await releaseUsage(reservationToCommit, {
              reason: 'usage_commit_failed',
              error: commitError instanceof Error ? commitError.message : String(commitError),
            }).catch((releaseError) => {
              logger.warn('Failed to release AI usage reservation after commit failure', releaseError);
            });
            aiReservationId = null;
          }
        }
        if (metadataPayload) {
          controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
        }

      } catch (err: any) {
        if (aiReservationId) {
          // Release reservation on provider failure or downstream stream failure.
          await releaseUsage(aiReservationId, {
            reason: 'stream_failed',
            error: err instanceof Error ? err.message : String(err),
          }).catch((releaseError) => {
            logger.warn('Failed to release AI usage reservation after stream failure', releaseError);
          });
          aiReservationId = null;
        }
        logger.error('Chat stream error', err);
        const { getDegradationMessage } = await import('@/lib/ai/degradation-messages');
        const fallbackMsg = err.message === 'RAG_SOURCE_PROCESSING' 
          ? getDegradationMessage('source_processing') 
          : getDegradationMessage('default');
        
        controller.enqueue(encoder.encode(`\n\n*${fallbackMsg}*`));
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
