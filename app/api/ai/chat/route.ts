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
import { generateJSON } from '@/lib/ai/provider-client';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { routeStreamGeneration, routeVisionCall } from '@/lib/ai/router';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { logger } from '@/lib/utils/logger';
import { orchestrateFromIntent } from '@/lib/engines/orchestrator';
import { logDecision } from '@/lib/utils/orchestratorLogger';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { MASTERY_WEIGHTS } from '@/lib/engines/cognition-graph';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { classifyMessageCombined } from '@/lib/ai/chat-intent-with-emotion';
import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';
import {
  assertDailyAIUsageBudget,
  isAIUsageBudgetExceeded,
  trackDailyAIUsage,
} from '@/lib/services/ai-usage.service';
import { invalidateSessionCards } from '@/lib/services/session-card-cache';
import {
  getOrCreateGlobalChatSession,
  loadRecentMessages,
  persistChatMessage,
  stripMetadataBlock,
} from '@/lib/services/chat-persistence';
import { ChatPlannerService } from '@/lib/services/chat-planner.service';
import { ChatTutorService } from '@/lib/services/chat-tutor.service';
import { ChatSideEffectService } from '@/lib/services/chat-side-effects.service';

const encoder = new TextEncoder();

export async function POST(req: NextRequest) {
  // ============================================================================
  // STAGE 1: REQUEST VALIDATION
  // ============================================================================
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { allowed, remaining, resetAt } = await checkRateLimit({
    identifier: user.id,
    bucket: 'chat',
    maxTokens: 30,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!allowed) return rateLimitResponse(remaining, resetAt);

  const ChatPayloadSchema = z.object({
    message: z.string().optional(),
    history: z.array(z.any()).optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.string().optional(),
    documentBase64: z.string().optional(),
    documentMimeType: z.string().optional(),
    chatId: z.string().optional(),
    sessionTurnsCount: z.number().optional()
  });

  let body;
  try {
    body = ChatPayloadSchema.parse(await req.json());
  } catch (err) {
    return new Response('Invalid JSON or Payload structure', { status: 400 });
  }

  const { message, imageBase64, imageMimeType, sessionTurnsCount } = body;
  const sessionId = await getOrCreateGlobalChatSession(supabase, user.id);

  if (imageBase64) {
    const imgValidation = validateBase64Payload(imageBase64, imageMimeType);
    if (!imgValidation.valid) return imgValidation.error!;
  }

  const persistedHistory = await loadRecentMessages(supabase, sessionId);
  const recentHistory = persistedHistory.slice(-50);

  const userMessageForPersistence = message || (imageBase64 ? '[Image question]' : '');
  if (!userMessageForPersistence.trim()) {
    return NextResponse.json({ error: 'Message or upload is required' }, { status: 400 });
  }

  try {
    await assertDailyAIUsageBudget({
      userId: user.id,
      kind: imageBase64 ? 'image' : 'chat',
      estimatedPromptTokens: Math.ceil((userMessageForPersistence.length + (imageBase64?.length || 0)) / 4),
      estimatedCompletionTokens: 1200,
      estimatedCost: imageBase64 ? 0.01 : undefined,
    });
  } catch (error) {
    if (isAIUsageBudgetExceeded(error)) {
      return NextResponse.json(
        {
          error: 'Daily AI budget exceeded',
          message: 'Your daily AI budget is used up. Existing plans, cards, and dashboards remain available.',
          limitUsd: error.limitUsd,
          usedUsd: error.usedUsd,
        },
        { status: error.status }
      );
    }
    throw error;
  }

  const { checkIdempotency } = await import('@/lib/middleware/idempotency');
  const idempotencyKey = req.headers.get('Idempotency-Key');
  const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'chat', idempotencyKey);

  if (idempError) return NextResponse.json({ error: idempError }, { status: 400 });
  if (isDuplicate) return NextResponse.json({ error: 'Duplicate request' }, { status: 409 });

  // ── MODULE 3: stable request id used as assistant message idempotency key ──
  // Format: "<requestId>:assistant"
  // The unique index on chat_messages(user_id, idempotency_key) ensures no
  // duplicate row is created even if this request is retried or the event
  // worker runs again.
  const requestId = idempotencyKey || crypto.randomUUID();

  // Persist user message (once, no idempotency key needed — request dedup above covers this)
  await persistChatMessage(supabase, {
    sessionId,
    userId: user.id,
    role: 'user',
    content: userMessageForPersistence,
  });

  // ============================================================================
  // STAGE 2: CONTEXT HYDRATION & INTENT (PARALLEL)
  // ============================================================================
  const profilePromise = supabase.from('profiles').select('exam_type').eq('id', user.id).maybeSingle();
  const intentPromise = classifyMessageCombined(
    message || '',
    recentHistory.slice(-2).map((m: any) => m.content).join(' '),
    undefined
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

  const mindContextPromise = getMINDContext(
    user.id,
    message,
    detectedIntent.topic || undefined,
    detectedIntent.subject || undefined
  ).catch((err) => {
    logger.error('Failed to get MIND context', err);
    return null;
  });

  const [semanticMemories, mindContext] = await Promise.all([
    Promise.race([memoryPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => [] as string[]),
    Promise.race([mindContextPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => null)
  ]) as [string[], any];

  let systemPrompt = getMINDSystemPrompt(mindContext, semanticMemories, detectedIntent.intent);
  const orchestratorResult = orchestrateFromIntent(
    detectedIntent,
    !!(imageBase64 && imageMimeType),
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
    const stream = new ReadableStream({
      async start(controller) {
        let answer = '';
        try {
          answer = await routeVisionCall(systemPrompt, imageBase64, imageMimeType, message || 'Solve this question completely.');
          controller.enqueue(encoder.encode(answer));
        } catch {
          answer = 'I had trouble reading that image. Try a clearer photo, or type the question out.';
          controller.enqueue(encoder.encode(answer));
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
            idempotencyKey: `${requestId}:assistant`,
          }));
        } catch (persistErr) {
          logger.error('Chat route [image]: failed to persist assistant message', persistErr);
          controller.close();
          return;
        }

        await trackDailyAIUsage({
          userId: user.id,
          kind: 'image',
          route: '/api/ai/chat',
          model: 'router:vision',
          promptTokens: Math.ceil((message || '').length / 4),
          completionTokens: Math.ceil(answer.length / 4),
        }).catch((e: Error) => logger.error('Image branch: billing failed', e));

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
  if (
    orchestratorResult.intent === 'mock_autopsy' &&
    orchestratorResult.needsFileProcessing &&
    (imageBase64 || body?.documentBase64)
  ) {
    const responseText = "I can see this is a mock-test upload. Full AUTOPSY runs outside the chat stream so the upload can be validated, extracted, and processed safely. Open AUTOPSY and upload the same file there; I'll use the processed result on the next turn.";

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
            metadata: { action: 'run_autopsy' },
            idempotencyKey: `${requestId}:assistant`,
          }));
        } catch (persistErr) {
          logger.error('Chat route [autopsy-redirect]: failed to persist assistant message', persistErr);
          controller.close();
          return;
        }

        await trackDailyAIUsage({
          userId: user.id,
          kind: 'chat',
          route: '/api/ai/chat',
          model: 'router:chat',
          promptTokens: Math.ceil((message || '').length / 4),
          completionTokens: Math.ceil(responseText.length / 4),
        }).catch((e: Error) => logger.error('Autopsy-redirect branch: billing failed', e));

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
            assistant_message_id: assistantMessageId,
          },
          idempotency_key: crypto.randomUUID(),
        }).catch((e: Error) => logger.error('Autopsy-redirect branch: event publish failed', e));

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
    const masteryPercent = mindContext.masteryStats.masteryPercent;
    const streakDays = mindContext.profile.streakDays;

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
            idempotencyKey: `${requestId}:assistant`,
          }));
        } catch (persistErr) {
          logger.error('Chat route [grounding]: failed to persist assistant message', persistErr);
          controller.close();
          return;
        }

        await trackDailyAIUsage({
          userId: user.id,
          kind: 'chat',
          route: '/api/ai/chat',
          model: 'router:chat',
          promptTokens: Math.ceil((message || '').length / 4),
          completionTokens: Math.ceil(groundingMessage.length / 4),
        }).catch((e: Error) => logger.error('Grounding branch: billing failed', e));

        // Worker receives assistant_message_id — must NOT persist again
        await EventDispatcher.publish({
          user_id: user.id,
          type: 'CHAT_MESSAGE_PROCESSED',
          data: {
            sessionId, message, fullResponse: groundingMessage, emotion,
            history: recentHistory, sessionTurnsCount, mindContext, intent,
            assistant_message_id: assistantMessageId,
          },
          idempotency_key: crypto.randomUUID(),
        }).catch((e: Error) => logger.error('Grounding branch: event publish failed', e));

        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }

  // ── Branch D: Main streaming branch ────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let metadataPayload: any = null;

      try {
        if (['AUTOPSY', 'ANALYTICS', 'ATLAS', 'FLASHCARDS'].includes(intent.intent)) {
          const routeMessages: Record<string, string> = {
            AUTOPSY: "Opening **AUTOPSY** — upload your mock test PDF or photo. I'll diagnose every wrong answer by root cause and show you your recoverable score.",
            FLASHCARDS: `You have **${mindContext?.overdueCards || 0}** cards due today. Opening your revision queue now.`,
            ATLAS: `Your knowledge map is at **${mindContext?.masteryStats?.masteryPercent || 0}%** mastery. Opening ATLAS now.`,
            ANALYTICS: `Opening your performance dashboard. You are currently at **${mindContext?.masteryStats?.masteryPercent || 0}%** overall mastery with **${mindContext?.overdueCards || 0}** cards due.`,
          };
          const msg = routeMessages[intent.intent] || 'Opening that for you now...';
          controller.enqueue(encoder.encode(msg));
          fullResponse = msg;
          metadataPayload = { action: intentToAction(intent.intent) };

        } else if (intent.intent === 'REPLAN') {
          const { fullResponse: reply, metadataPayload: payload } = await ChatPlannerService.handleReplan(
            supabase, user.id, intent.action || 'reduce_tasks', controller, encoder
          );
          fullResponse = reply;
          metadataPayload = payload;
        } else if (intent.intent === 'CREATE_ARTIFACT' || orchestratorResult.intent === 'planning') {
          const { fullResponse: reply, metadataPayload: payload } = await ChatPlannerService.handleCreateArtifact(
            supabase, user.id, systemPrompt, recentHistory, message || '', controller, encoder
          );
          fullResponse = reply;
          metadataPayload = payload;
        } else if (['TUTOR_SESSION', 'PRACTICE'].includes(intent.intent)) {
          const { fullResponse: reply, metadataPayload: payload } = await ChatTutorService.handleTutorSession(
            supabase, user.id, intent, mindContext, systemPrompt, recentHistory, message || '', sessionTurnsCount, controller, encoder
          );
          fullResponse = reply;
          metadataPayload = payload;
        } else {
          const conversationMessages = buildConversationMessages(recentHistory, message || '');
          for await (const chunk of routeStreamGeneration(systemPrompt, conversationMessages, 0.7)) {
            controller.enqueue(encoder.encode(chunk));
            fullResponse += chunk;
          }
        }

        const contextTrace = {
          learner_state_version: mindContext?.profile?.learnerStateVersion || 0,
          memory_count: semanticMemories.length,
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
            idempotencyKey: `${requestId}:assistant`,
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
        });

      } catch (err: any) {
        logger.error('Chat stream error', err);
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
