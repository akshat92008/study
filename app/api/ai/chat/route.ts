// app/api/ai/chat/route.ts
//
// MODULE 3 PATCH — global chat persistence fix.
//
// Canonical write rules:
//   • User message   → persisted ONCE before any AI call (line ~119).
//   • Assistant msg  → persisted ONCE in the route, with idempotencyKey, returning its DB id.
//   • CHAT_MESSAGE_PROCESSED events carry assistant_message_id so the worker never re-inserts.
//   • ChatSideEffectService / processChatSideEffects do NOT call persistChatMessage.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { routeStreamGeneration, routeVisionCall } from '@/lib/ai/router';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { logger } from '@/lib/utils/logger';
import { orchestrateFromIntent } from '@/lib/engines/orchestrator';
import { logDecision } from '@/lib/utils/orchestratorLogger';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { classifyMessageCombined } from '@/lib/ai/chat-intent-with-emotion';
import { inferAndUpdateEmotionalState } from '@/lib/engines/emotional-state-updater';
import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { isAutopsyUploadIntent } from '@/lib/autopsy/upload-intent';
import { createAutopsyJob } from '@/lib/services/autopsy-jobs';
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { consumeUsageLimit, usageGateResponse, validatePromptLength } from '@/lib/utils/billing';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import {
  budgetExceededResponse,
  budgetUnavailableResponse,
  commitBudgetUsage,
  isBudgetExceeded,
  isBudgetUnavailable,
  releaseBudgetReservation,
  reserveBudgetForModelCall,
  type BudgetFeature,
  type BudgetReservation,
} from '@/lib/ai/cost-guard';
import {
  getOrCreateGlobalChatSession,
  loadRecentMessagesForClient,
  loadRecentMessages,
  persistChatMessage,
  stripMetadataBlock,
} from '@/lib/services/chat-persistence';
import { ChatSideEffectService } from '@/lib/services/chat-side-effects.service';
import {
  ensureCommandPlanForDate,
  formatCommandPlanForChat,
  formatRevisionQueueForChat,
  formatWeakAreasForChat,
  localDateAfter,
} from '@/lib/services/command-plan.service';

const encoder = new TextEncoder();

export async function GET(request?: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const sessionId = await getOrCreateGlobalChatSession(supabase, user.id);
    const messages = await loadRecentMessagesForClient(supabase, sessionId);

    return NextResponse.json({ sessionId, messages }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to hydrate global chat', error, { requestId, feature: 'chat' });
    return apiErrorResponse('chat_hydration_failed', {
      status: 500,
      message: 'Unable to load MIND chat history.',
      requestId,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ============================================================================
    // STAGE 1: REQUEST VALIDATION
    // ============================================================================
    const requestId = getRequestId(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    logger.info('Chat request started', { userId: user.id, requestId, feature: 'chat' });

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'chat',
      maxTokens: 30,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const ChatPayloadSchema = z.object({
      message: z.string().nullable().optional(),
      content: z.string().nullable().optional(),
      text: z.string().nullable().optional(),
      input: z.string().nullable().optional(),
      prompt: z.string().nullable().optional(),

      history: z.array(z.any()).nullable().optional(),

      imageBase64: z.string().nullable().optional(),
      imageMimeType: z.string().nullable().optional(),
      documentBase64: z.string().nullable().optional(),
      documentMimeType: z.string().nullable().optional(),

      chatId: z.string().nullable().optional(),
      activeGoalId: z.string().nullable().optional(),

      sessionTurnsCount: z.number().nullable().optional()
    });

    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch (jsonErr) {
      logger.warn('Invalid JSON in request', {
        requestId,
        userId: user.id,
        reason: jsonErr instanceof Error ? jsonErr.message : 'unknown',
        feature: 'chat'
      });
      return apiErrorResponse('invalid_chat_payload', {
        status: 400,
        message: 'MIND could not read the chat request payload.',
        requestId,
      });
    }

    let parsed;
    try {
      parsed = ChatPayloadSchema.parse(rawBody);
    } catch (err) {
      logger.warn('Invalid chat payload', {
        requestId,
        userId: user.id,
        receivedKeys: Object.keys(rawBody ?? {}),
        reason: err instanceof Error ? err.message : 'unknown',
      });
      return NextResponse.json({
        error: 'invalid_chat_payload',
        message: 'MIND could not read the chat request payload.',
        requestId,
      }, { status: 400 });
    }

    const message =
      parsed.message ??
      parsed.content ??
      parsed.text ??
      parsed.input ??
      parsed.prompt ??
      '';

    const history = Array.isArray(parsed.history) ? parsed.history : [];
    const imageBase64 = parsed.imageBase64 ?? undefined;
    const imageMimeType = parsed.imageMimeType ?? undefined;
    const documentBase64 = parsed.documentBase64 ?? undefined;
    const documentMimeType = parsed.documentMimeType ?? undefined;
    const chatId = parsed.chatId ?? undefined;
    const activeGoalId = parsed.activeGoalId ?? undefined;
    const sessionTurnsCount = parsed.sessionTurnsCount ?? 0;
    const promptVersion = getPromptVersion('mind');
    const sessionId = await getOrCreateGlobalChatSession(supabase, user.id);

    if (imageBase64) {
      const imgValidation = validateBase64Payload(imageBase64, imageMimeType);
      if (!imgValidation.valid) return imgValidation.error!;
    }
    if (documentBase64) {
      const docValidation = validateBase64Payload(documentBase64, documentMimeType);
      if (!docValidation.valid) return docValidation.error!;
    }

    const persistedHistory = await loadRecentMessages(supabase, sessionId);
    const recentHistory = persistedHistory.slice(-50);

    const userMessageForPersistence = message || (imageBase64 ? '[Image question]' : documentBase64 ? '[Document upload]' : '');
    if (!userMessageForPersistence.trim()) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Message or upload is required.',
        requestId,
      });
    }

    const { checkIdempotency } = await import('@/lib/middleware/idempotency');
    const idempotencyKey = req.headers.get('Idempotency-Key');
    const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'chat', idempotencyKey);

    if (idempError) {
      return apiErrorResponse('invalid_idempotency_key', {
        status: 400,
        message: idempError,
        requestId,
      });
    }
    if (isDuplicate) {
      return apiErrorResponse('duplicate_request', {
        status: 409,
        message: 'Duplicate request.',
        requestId,
      });
    }

    // ── MODULE 3: stable request id used as assistant message idempotency key ──
    // Format: "<requestId>:assistant"
    // The unique index on chat_messages(user_id, idempotency_key) ensures no
    // duplicate row is created even if this request is retried or the event
    // worker runs again.
    const messageRequestId = idempotencyKey || requestId;

    const promptLength = validatePromptLength(userMessageForPersistence);
    if (!promptLength.allowed) return usageGateResponse(promptLength);

    const usageGate = await consumeUsageLimit(user.id, 'chat_messages_daily');
    if (!usageGate.allowed) return usageGateResponse(usageGate);

    // Persist user message (once, no idempotency key needed — request dedup above covers this)
    const { id: userMessageId } = await persistChatMessage(supabase, {
      sessionId,
      userId: user.id,
      role: 'user',
      content: userMessageForPersistence,
    });
    void inferAndUpdateEmotionalState(user.id, userMessageForPersistence).catch((err) => {
      logger.warn('Chat route emotional-state updater failed', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // ============================================================================
    // STAGE 2: CONTEXT HYDRATION & INTENT (PARALLEL)
    // ============================================================================
    const profilePromise = supabase.from('profiles').select('exam_type').eq('id', user.id).maybeSingle();
    const intentPromise = classifyMessageCombined(
      message || '',
      recentHistory.slice(-2).map((m: any) => m.content).join(' '),
      undefined,
      user.id
    );

    const [profileResult, intentResult] = await Promise.all([
      Promise.race([profilePromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1500))]).catch(() => ({ data: null })),
      Promise.race([intentPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1500))]).catch(() => ({
        intent: { intent: 'GENERAL_CHAT' }, emotion: 'neutral', confidence: 0.5
      }))
    ]) as [any, any];

    const profilePreview = profileResult?.data;
    const { intent: detectedIntent, emotion } = intentResult;

    // ============================================================================
    // STAGE 3 & 4: MEMORY RETRIEVAL & STUDENT MODEL (PARALLEL)
    // ============================================================================
    const memoryPromise = (message && message.trim().length > 15)
      ? new ChatMemoryService().searchMemory(user.id, message, 2).catch((err) => {
          logger.error('CRITICAL: Semantic memory failed', err);
          return [] as string[];
        })
      : Promise.resolve([] as string[]);
    const episodicMemoryPromise = (message && message.trim().length > 15)
      ? new EpisodicMemoryService().retrieveRelevant(user.id, message, 2).catch((err) => {
          logger.warn('Episodic memory retrieval failed', err);
          return [] as string[];
        })
      : Promise.resolve([] as string[]);

    const mindContextPromise = getMINDContext(
      user.id,
      message,
      detectedIntent.topic || undefined,
      detectedIntent.subject || undefined
    ).catch((err) => {
      logger.error('Failed to get MIND context', err);
      return null;
    });

    const [semanticMemories, episodicMemories, mindContext] = await Promise.all([
      Promise.race([memoryPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => [] as string[]),
      Promise.race([episodicMemoryPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => [] as string[]),
      Promise.race([mindContextPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => null)
    ]) as [string[], string[], any];

    const crossSessionMemories = [
      ...episodicMemories.map((memory) => `Episode: ${memory}`),
      ...semanticMemories,
    ].slice(0, 4);
    let systemPrompt = getMINDSystemPrompt(mindContext, crossSessionMemories, detectedIntent.intent);
    const hasUploadedFile = !!((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType));
    const orchestratorResult = orchestrateFromIntent(
      detectedIntent,
      hasUploadedFile,
      message || ''
    );
    await logDecision(orchestratorResult, user.id, message || '').catch(() => {});

    // ============================================================================
    // STAGE 5: AI ORCHESTRATION & STREAMING
    // ============================================================================

    // ── Branch A: Image / vision call ──────────────────────────────────────────
    if (
      imageBase64 &&
      imageMimeType &&
      !(orchestratorResult.intent === 'mock_autopsy' && orchestratorResult.needsFileProcessing)
    ) {
      const imageBudget = await reserveModelBudgetOrResponse({
        userId: user.id,
        feature: 'image',
        model: 'router:vision',
        estimatedInputTokens: estimateTextTokens(systemPrompt, message || '[Image question]') + 1200,
        estimatedOutputTokens: 1200,
      });
      if (imageBudget instanceof Response) return imageBudget;

      const stream = new ReadableStream({
        async start(controller) {
          let answer = '';
          let budgetSettled = false;
          try {
            answer = await routeVisionCall(systemPrompt, imageBase64, imageMimeType, message || 'Solve this question completely.');
            controller.enqueue(encoder.encode(answer));
          } catch {
            await releaseBudgetReservation(imageBudget.reservationId, 'vision_call_failed');
            budgetSettled = true;
            answer = 'I had trouble reading that image. Try a clearer photo, or type the question out.';
            controller.enqueue(encoder.encode(answer));
          }

          if (!budgetSettled) {
            await commitBudgetUsage(imageBudget.reservationId, {
              promptTokens: estimateTextTokens(systemPrompt, message || '[Image question]') + 1200,
              completionTokens: estimateTextTokens(answer),
              route: '/api/ai/chat',
              promptVersion,
              promptFamily: 'mind_chat',
              promptSource: 'chat_image',
            });
            budgetSettled = true;
          }

          // ── MODULE 3: persist assistant message ONCE, capture id ──
          let assistantMessageId: string;
          try {
            ({ id: assistantMessageId } = await persistChatMessage(supabase, {
              sessionId,
              userId: user.id,
              role: 'assistant',
              content: answer,
              intent: detectedIntent.intent,
              emotionalState: emotion,
              promptVersion,
              idempotencyKey: `${messageRequestId}:assistant`,
            }));
          } catch (persistErr) {
            logger.error('Chat route [image]: failed to persist assistant message', persistErr);
            controller.close();
            return;
          }

          // Worker receives assistant_message_id — must NOT persist again
          await EventDispatcher.publish({
            user_id: user.id,
            type: 'CHAT_MESSAGE_PROCESSED',
            data: {
              sessionId,
              message: message || '[Image question]',
              fullResponse: answer,
              emotion,
              history: recentHistory,
              sessionTurnsCount,
              mindContext,
              intent: detectedIntent,
              user_message_id: userMessageId,
              assistant_message_id: assistantMessageId,
            },
            idempotency_key: crypto.randomUUID(),
          }).catch((e: Error) => logger.error('Image branch: event publish failed', e));

          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── Branch B: Mock-autopsy file redirect ───────────────────────────────────
    const shouldRouteUploadToAutopsy =
      hasUploadedFile &&
      (
        (orchestratorResult.intent === 'mock_autopsy' && orchestratorResult.needsFileProcessing) ||
        isAutopsyUploadIntent(message || '')
      );

    if (shouldRouteUploadToAutopsy && ((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType))) {
      const fileData = imageBase64 && imageMimeType
        ? { kind: 'inline' as const, mimeType: imageMimeType, data: imageBase64 }
        : documentMimeType?.startsWith('text/')
          ? { kind: 'text' as const, text: Buffer.from(documentBase64!, 'base64').toString('utf8') }
          : { kind: 'inline' as const, mimeType: documentMimeType!, data: documentBase64! };

      const job = await createAutopsyJob({
        userId: user.id,
        fileData,
        testName: 'MIND Chat Upload',
        examType: profilePreview?.exam_type || 'General Study',
        idempotencyKey: `${messageRequestId}:autopsy`,
        source: 'chat_upload',
        client: supabase,
      });

      const responseText = job.status === 'completed'
        ? "I found an existing completed Test Analysis for this upload. Opening Test Analysis now so you can review the processed result."
        : "I've queued this upload for Test Analysis. AUTOPSY will validate the file, classify only evidence-backed mistakes, update ATLAS and MEMORY through events, and I'll use the updated learner state on the next turn.";

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(responseText));

          // ── MODULE 3: persist assistant message ONCE, capture id ──
          let assistantMessageId: string;
          try {
            ({ id: assistantMessageId } = await persistChatMessage(supabase, {
              sessionId,
              userId: user.id,
              role: 'assistant',
              content: responseText,
              intent: detectedIntent.intent,
              emotionalState: emotion,
              metadata: { action: 'run_autopsy', jobId: job.id, status: job.status },
              promptVersion,
              idempotencyKey: `${messageRequestId}:assistant`,
            }));
          } catch (persistErr) {
            logger.error('Chat route [autopsy-redirect]: failed to persist assistant message', persistErr);
            controller.close();
            return;
          }

          // Worker receives assistant_message_id — must NOT persist again
          await EventDispatcher.publish({
            user_id: user.id,
            type: 'CHAT_MESSAGE_PROCESSED',
            data: {
              sessionId,
              message: message || '[Autopsy upload]',
              fullResponse: responseText,
              emotion,
              history: recentHistory,
              sessionTurnsCount,
              mindContext,
              intent: detectedIntent,
              metadataPayload: { action: 'run_autopsy', jobId: job.id, status: job.status },
              user_message_id: userMessageId,
              assistant_message_id: assistantMessageId,
            },
            idempotency_key: crypto.randomUUID(),
          }).catch((e: Error) => logger.error('Autopsy-redirect branch: event publish failed', e));

          controller.close();
        }
      });

      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (documentBase64 && documentMimeType) {
      const documentBudget = await reserveModelBudgetOrResponse({
        userId: user.id,
        feature: 'chat',
        model: 'router:document',
        estimatedInputTokens: estimateTextTokens(systemPrompt, message || '[Document upload]') + Math.ceil(Buffer.byteLength(documentBase64, 'base64') / 4),
        estimatedOutputTokens: 1200,
      });
      if (documentBudget instanceof Response) return documentBudget;

      const stream = new ReadableStream({
        async start(controller) {
          let answer = '';
          let budgetSettled = false;
          try {
            answer = await routeVisionCall(
              systemPrompt,
              documentBase64,
              documentMimeType,
              message || 'Read this document and explain the useful study context without inventing details.'
            );
            controller.enqueue(encoder.encode(answer));
          } catch {
            await releaseBudgetReservation(documentBudget.reservationId, 'document_call_failed');
            budgetSettled = true;
            answer = 'I could not read that document reliably. If this is for Test Analysis, upload it with your answer key, student answers, OMR sheet, or result sheet. For explanation, paste the relevant text here.';
            controller.enqueue(encoder.encode(answer));
          }

          if (!budgetSettled) {
            await commitBudgetUsage(documentBudget.reservationId, {
              promptTokens: estimateTextTokens(systemPrompt, message || '[Document upload]') + Math.ceil(Buffer.byteLength(documentBase64, 'base64') / 4),
              completionTokens: estimateTextTokens(answer),
              route: '/api/ai/chat',
              promptVersion,
              promptFamily: 'mind_chat',
              promptSource: 'chat_document',
            });
            budgetSettled = true;
          }

          let assistantMessageId: string;
          try {
            ({ id: assistantMessageId } = await persistChatMessage(supabase, {
              sessionId,
              userId: user.id,
              role: 'assistant',
              content: answer,
              intent: detectedIntent.intent,
              emotionalState: emotion,
              promptVersion,
              idempotencyKey: `${messageRequestId}:assistant`,
            }));
          } catch (persistErr) {
            logger.error('Chat route [document]: failed to persist assistant message', persistErr);
            controller.close();
            return;
          }

          await EventDispatcher.publish({
            user_id: user.id,
            type: 'CHAT_MESSAGE_PROCESSED',
            data: {
              sessionId,
              message: message || '[Document upload]',
              fullResponse: answer,
              emotion,
              history: recentHistory,
              sessionTurnsCount,
              mindContext,
              intent: detectedIntent,
              user_message_id: userMessageId,
              assistant_message_id: assistantMessageId,
            },
            idempotency_key: crypto.randomUUID(),
          }).catch((e: Error) => logger.error('Document branch: event publish failed', e));

          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const intent = detectedIntent;

    // ── Branch C: Overwhelmed / emotional grounding ────────────────────────────
    if (
      mindContext?.emotionalState === 'overwhelmed' &&
      ['TUTOR_SESSION', 'PRACTICE'].includes(orchestratorResult.intent)
    ) {
      const recentVictory = mindContext.weakConcepts.find((c: any) =>
        c.mastery === 'developing' || c.mastery === 'proficient'
      );
      const masteryPercent = mindContext.masteryStats?.masteryPercent || 0;
      const streakDays = mindContext.profile?.streakDays || 0;

      const groundingMessage = [
        `Before we go into ${intent.topic || 'that topic'} — I'm noticing you seem overwhelmed right now, and I'm not going to add more to the pile.`,
        ``,
        `Here's what's actually true right now: you're at ${masteryPercent}% mastery across your syllabus.`,
        streakDays > 1 ? `You've shown up ${streakDays} days in a row. That's not nothing.` : '',
        recentVictory ? `You're developing ${recentVictory.name} — that's real progress, not luck.` : '',
        ``,
        `Right now, pick one of these:`,
        ``,
        `**1. Take 10 minutes away from your screen.** Come back and we'll tackle one small thing together.`,
        ``,
        `**2. Tell me one specific thing that's making you feel stuck.** Not "everything" — one thing. I'll help you sort it.`,
        ``,
        `**3. Do 5 flashcard reviews only.** Short. Familiar. It'll remind your brain it still knows things.`,
        ``,
        `Which one works for right now?`,
      ].filter(Boolean).join('\n');

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(groundingMessage));

          // ── MODULE 3: persist assistant message ONCE, capture id ──
          let assistantMessageId: string;
          try {
            ({ id: assistantMessageId } = await persistChatMessage(supabase, {
              sessionId,
              userId: user.id,
              role: 'assistant',
              content: groundingMessage,
              intent: intent.intent,
              emotionalState: emotion,
              promptVersion,
              idempotencyKey: `${messageRequestId}:assistant`,
            }));
          } catch (persistErr) {
            logger.error('Chat route [grounding]: failed to persist assistant message', persistErr);
            controller.close();
            return;
          }

          // Worker receives assistant_message_id — must NOT persist again
          await EventDispatcher.publish({
            user_id: user.id,
            type: 'CHAT_MESSAGE_PROCESSED',
            data: {
              sessionId, message, fullResponse: groundingMessage, emotion,
              history: recentHistory, sessionTurnsCount, mindContext, intent,
              user_message_id: userMessageId,
              assistant_message_id: assistantMessageId,
            },
            idempotency_key: crypto.randomUUID(),
          }).catch((e: Error) => logger.error('Grounding branch: event publish failed', e));

          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
    }

    const deterministicEngineResponse = await buildChatFirstEngineResponse({
      userId: user.id,
      message: message || '',
      intent: intent.intent,
      orchestratorIntent: orchestratorResult.intent,
      mindContext,
      supabase,
    });

    if (deterministicEngineResponse) {
      const responseText = deterministicEngineResponse.text;
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(responseText));

          let assistantMessageId = '';
          try {
            ({ id: assistantMessageId } = await persistChatMessage(supabase, {
              sessionId,
              userId: user.id,
              role: 'assistant',
              content: responseText,
              intent: intent.intent,
              emotionalState: emotion,
              metadata: deterministicEngineResponse.metadata,
              promptVersion,
              idempotencyKey: `${messageRequestId}:assistant`,
            }));
          } catch (persistErr) {
            logger.error('Chat route [deterministic-engine]: failed to persist assistant message', persistErr);
          }

          await ChatSideEffectService.finalizeChatResponse({
            supabase,
            userId: user.id,
            sessionId,
            message: message || '',
            fullResponse: responseText,
            intent,
            emotion,
            metadataPayload: deterministicEngineResponse.metadata,
            recentHistory,
            sessionTurnsCount,
            mindContext,
            assistantMessageId,
            userMessageId,
          });

          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Accel-Buffering': 'no',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // ── Branch D: Main streaming branch ────────────────────────────────────────
    const mainBudget = shouldReserveMainChatBudget(intent.intent)
      ? await reserveModelBudgetOrResponse({
          userId: user.id,
          feature: budgetFeatureForMainChat(intent.intent, orchestratorResult.intent),
          model: 'router:chat',
          estimatedInputTokens: estimateMainPromptTokens(systemPrompt, recentHistory, message || ''),
          estimatedOutputTokens: 1600,
        })
      : null;
    if (mainBudget instanceof Response) return mainBudget;

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        let metadataPayload: any = null;
        let budgetSettled = false;

        try {
          if (['AUTOPSY', 'ATLAS', 'FLASHCARDS'].includes(intent.intent)) {
            const routeMessages: Record<string, string> = {
              AUTOPSY: "Opening **Test Analysis** — upload your mock test PDF or photo. I'll diagnose every wrong answer by root cause and show you your recoverable score.",
              FLASHCARDS: `You have **${mindContext?.overdueCardsCount || 0}** cards due today. Opening your revision queue now.`,
              ATLAS: `Your knowledge map is at **${mindContext?.masteryStats?.masteryPercent || 0}%** mastery. Opening Progress now.`,
            };
            const msg = routeMessages[intent.intent] || 'Opening that for you now...';
            controller.enqueue(encoder.encode(msg));
            fullResponse = msg;
            metadataPayload = { action: intentToAction(intent.intent) };
          } else {
            const conversationMessages = buildConversationMessages(recentHistory, message || '');
            for await (const chunk of routeStreamGeneration(systemPrompt, conversationMessages, 0.7)) {
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
          };
          metadataPayload = { ...(metadataPayload || {}), contextTrace };

          if (metadataPayload) {
            controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
          }

          // ── MODULE 3: persist assistant message ONCE in route ──────────────
          // The streaming is done; fullResponse is complete. Persist here, before
          // the side-effect event, so the worker never needs to insert.
          const cleanContent = stripMetadataBlock(fullResponse);
          if (mainBudget) {
            await commitBudgetUsage(mainBudget.reservationId, {
              promptTokens: estimateMainPromptTokens(systemPrompt, recentHistory, message || ''),
              completionTokens: estimateTextTokens(cleanContent),
              route: '/api/ai/chat',
              promptVersion,
              promptFamily: 'mind_chat',
              promptSource: 'chat_stream',
            });
            budgetSettled = true;
          }

          let assistantMessageId: string;
          try {
            ({ id: assistantMessageId } = await persistChatMessage(supabase, {
              sessionId,
              userId: user.id,
              role: 'assistant',
              content: cleanContent,
              intent: intent.intent,
              emotionalState: emotion,
              metadata: metadataPayload ?? {},
              promptVersion,
              idempotencyKey: `${messageRequestId}:assistant`,
            }));
          } catch (persistErr) {
            logger.error('Chat route [streaming]: failed to persist assistant message', persistErr);
            // Don't rethrow — we still want side effects to fire if possible.
            // Assign a sentinel so finalizeChatResponse can log the gap.
            assistantMessageId = '';
          }

          // ── STAGE 6 & 7: ASYNC SIDE EFFECTS (QUEUED) ──────────────────────
          // assistantMessageId is threaded through so the worker never persists again.
          await ChatSideEffectService.finalizeChatResponse({
            supabase,
            userId: user.id,
            sessionId,
            message: message || '',
            fullResponse,
            intent,
            emotion,
            metadataPayload,
            recentHistory,
            sessionTurnsCount,
            mindContext,
            assistantMessageId,
            userMessageId,
          });

        } catch (err: any) {
          logger.error('Chat stream error', err);
          if (mainBudget && !budgetSettled) {
            await releaseBudgetReservation(
              mainBudget.reservationId,
              err instanceof Error ? err.message : 'chat_stream_error'
            );
            budgetSettled = true;
          }
          controller.enqueue(encoder.encode('\n\n[Something went wrong. Please try again.]'));
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
      }
    });
  } catch (error) {
    const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
    return unexpectedApiErrorResponse(req, error, 'chat_route_unhandled');
  }
}

function intentToAction(intent: string): string {
  const map: Record<string, string> = {
    AUTOPSY: 'run_autopsy',
    ANALYTICS: 'show_analytics',
    ATLAS: 'show_atlas',
    FLASHCARDS: 'show_flashcards',
  };
  return map[intent] || 'show_analytics';
}

function shouldReserveMainChatBudget(intent: string): boolean {
  if (['AUTOPSY', 'ATLAS', 'FLASHCARDS'].includes(intent)) {
    return false;
  }
  return true;
}

function budgetFeatureForMainChat(_intent: string, _orchestratorIntent?: string): BudgetFeature {
  return 'chat';
}

async function reserveModelBudgetOrResponse(input: {
  userId: string;
  feature: BudgetFeature;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}): Promise<BudgetReservation | Response> {
  try {
    return await reserveBudgetForModelCall(
      input.userId,
      input.feature,
      input.model,
      input.estimatedInputTokens,
      input.estimatedOutputTokens
    );
  } catch (error) {
    if (isBudgetExceeded(error)) return budgetExceededResponse();
    if (isBudgetUnavailable(error)) return budgetUnavailableResponse();
    throw error;
  }
}

function estimateMainPromptTokens(systemPrompt: string, recentHistory: any[], message: string): number {
  const historyText = recentHistory
    .slice(-12)
    .map((item: any) => `${item?.role || ''}:${item?.content || ''}`)
    .join('\n');
  return estimateTextTokens(systemPrompt, historyText, message);
}

function estimateTextTokens(...parts: Array<string | null | undefined>): number {
  const chars = parts.reduce((sum, part) => sum + (part?.length || 0), 0);
  return Math.max(1, Math.ceil(chars / 4));
}

async function buildChatFirstEngineResponse(input: {
  userId: string;
  message: string;
  intent: string;
  orchestratorIntent: string;
  mindContext: any;
  supabase: any;
}): Promise<{ text: string; metadata: Record<string, any> } | null> {
  const normalized = input.message.toLowerCase();
  const asksForPlan =
    input.orchestratorIntent === 'planning' ||
    /\b(what should i do tomorrow|tomorrow'?s plan|study plan for tomorrow|plan tomorrow|what should i study tomorrow)\b/i.test(input.message);
  const asksWeakAreas =
    input.intent === 'ATLAS' ||
    /\b(weakest areas|weak areas|weak chapters|where am i weak|what am i weak)\b/i.test(input.message);
  const asksRevision =
    input.intent === 'FLASHCARDS' ||
    /\b(what should i revise now|revise now|due revision|due cards|memory queue)\b/i.test(input.message);
  const asksAutopsyWithoutEvidence =
    input.intent === 'AUTOPSY' &&
    /\b(analy[sz]e my test|check my mock|autopsy|test analysis|paper analysis)\b/i.test(input.message);

  if (asksForPlan) {
    const plan = await ensureCommandPlanForDate({
      userId: input.userId,
      date: localDateAfter(/\btomorrow\b/i.test(normalized) ? 1 : 0),
      client: input.supabase,
    });
    return {
      text: formatCommandPlanForChat(plan),
      metadata: {
        action: 'show_command_plan',
        date: plan.date,
        taskCount: plan.tasks.length,
        sourceSignals: plan.sourceSignals,
      },
    };
  }

  if (asksWeakAreas) {
    return {
      text: formatWeakAreasForChat({
        weakConcepts: input.mindContext?.weakConcepts ?? [],
        recentMistakes: input.mindContext?.recentMistakes ?? [],
        masteryPercent: input.mindContext?.masteryStats?.masteryPercent ?? 0,
      }),
      metadata: {
        action: 'answer_atlas_inline',
        weakConceptCount: input.mindContext?.weakConcepts?.length ?? 0,
        mistakeCount: input.mindContext?.recentMistakes?.length ?? 0,
      },
    };
  }

  if (asksRevision) {
    return {
      text: formatRevisionQueueForChat({
        dueCount: input.mindContext?.overdueCardsCount ?? 0,
        cards: input.mindContext?.topOverdueCards ?? [],
      }),
      metadata: {
        action: 'answer_memory_inline',
        dueCardCount: input.mindContext?.overdueCardsCount ?? 0,
      },
    };
  }

  if (asksAutopsyWithoutEvidence) {
    return {
      text: [
        'AUTOPSY needs evidence before it can diagnose. Upload or paste one of these inside this chat:',
        '1. answer key plus your answers',
        '2. OMR or response sheet',
        '3. score/subject breakdown',
        '4. mistake rows with question, correct answer, your answer, and chapter',
        'I will only update ATLAS, MEMORY, and COMMAND from evidence-backed mistakes.',
      ].join('\n'),
      metadata: {
        action: 'request_autopsy_evidence',
      },
    };
  }

  return null;
}
