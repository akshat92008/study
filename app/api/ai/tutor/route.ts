import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { routeStreamGeneration } from '@/lib/ai/router';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { getMINDContext } from '@/lib/engines/mind-engine';
import { getMINDSystemPrompt } from '@/lib/ai/prompts/mind-prompt';
import { reserveBudgetForModelCall, isBudgetExceeded, isBudgetUnavailable, budgetExceededResponse, budgetUnavailableResponse, registerPromptAudit } from '@/lib/ai/cost-guard';
import { estimateTokensFromText } from '@/lib/ai/token-budget';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { consumeUsageLimit, validatePromptLength, usageGateResponse } from '@/lib/utils/billing';
import { logger } from '@/lib/utils/logger';
import {
  getOrCreateChatSession,
  loadRecentMessages,
  loadRecentMessagesForClient,
  persistChatMessage,
} from '@/lib/services/chat-persistence';
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { inferAndUpdateEmotionalState } from '@/lib/engines/emotional-state-updater';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import { publishTutorProgressEvents } from '@/lib/mind/tutor-completion';

const encoder = new TextEncoder();

const TutorPayloadSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.any()).optional().default([]),
  topic: z.string().optional(),
  subject: z.string().optional(),
  sessionTurnsCount: z.number().int().nonnegative().optional(),
});

export async function GET(request?: NextRequest) {
  const requestId = getRequestId(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return apiErrorResponse('unauthorized', {
      status: 401,
      message: 'Authentication is required.',
      requestId,
    });
  }

  const sessionId = await getOrCreateChatSession(supabase, user.id, 'tutor', 'AI Tutor');
  const messages = await loadRecentMessagesForClient(supabase, sessionId);
  return NextResponse.json({ sessionId, messages }, { headers: { 'x-request-id': requestId } });
}

export async function POST(req: NextRequest) {
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

  const { allowed, remaining, resetAt } = await checkRateLimit({
    identifier: user.id,
    bucket: 'tutor',
    maxTokens: 20,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!allowed) return rateLimitResponse(remaining, resetAt);

  let parsed: z.infer<typeof TutorPayloadSchema>;
  try {
    parsed = TutorPayloadSchema.parse(await req.json());
  } catch {
    return apiErrorResponse('invalid_tutor_payload', {
      status: 400,
      message: 'Tutor could not read the request payload.',
      requestId,
    });
  }

  const promptLength = validatePromptLength(parsed.message);
  if (!promptLength.allowed) return usageGateResponse(promptLength);
  const usageGate = await consumeUsageLimit(user.id, 'tutor_messages_daily');
  if (!usageGate.allowed) return usageGateResponse(usageGate);

  const { checkIdempotency } = await import('@/lib/middleware/idempotency');
  const idempotencyKey = req.headers.get('Idempotency-Key');
  const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'tutor_chat', idempotencyKey);
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

  const sessionId = await getOrCreateChatSession(supabase, user.id, 'tutor', 'AI Tutor');
  const persistedHistory = await loadRecentMessages(supabase, sessionId);
  const recentHistory = persistedHistory.length ? persistedHistory : parsed.history.slice(-20);
  const tutorTurnsCount = Math.max(
    parsed.sessionTurnsCount ?? 0,
    recentHistory.filter((turn: any) => turn?.role === 'user').length + 1
  );
  const messageRequestId = idempotencyKey || requestId;
  const promptVersion = getPromptVersion('tutor');

  const { id: userMessageId } = await persistChatMessage(supabase, {
    sessionId,
    userId: user.id,
    role: 'user',
    content: parsed.message,
    metadata: { source_type: 'tutor_chat' },
  });
  void inferAndUpdateEmotionalState(user.id, parsed.message).catch(() => {});

  const mindContext = await getMINDContext(user.id, parsed.message, parsed.topic, parsed.subject);
  const systemPrompt = getMINDSystemPrompt(mindContext, [], 'TUTOR_SESSION');
  const conversationMessages = buildConversationMessages(recentHistory, parsed.message);

  let reservationId: string;
  try {
    const reservation = await reserveBudgetForModelCall(
      user.id,
      'tutor',
      'router:tutor',
      estimateTokensFromText(systemPrompt, JSON.stringify(conversationMessages)),
      1600
    );
    reservationId = reservation.reservationId;
    registerPromptAudit(reservationId, {
      userId: user.id,
      promptVersion,
      promptFamily: 'tutor_chat',
      promptSource: 'tutor_route',
      route: '/api/ai/tutor',
    });
  } catch (error) {
    if (isBudgetExceeded(error)) return budgetExceededResponse();
    if (isBudgetUnavailable(error)) return budgetUnavailableResponse();
    throw error;
  }

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        for await (const chunk of routeStreamGeneration(systemPrompt, conversationMessages, 0.7, reservationId)) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        const { id: assistantMessageId } = await persistChatMessage(supabase, {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: fullResponse,
          metadata: { source_type: 'tutor_chat' },
          promptVersion,
          idempotencyKey: `${messageRequestId}:assistant`,
        });

        const memory = new ChatMemoryService();
        const episodes = new EpisodicMemoryService();
        await memory.storeConversationTurnInMemory(user.id, {
          sourceType: 'tutor_chat',
          sessionId,
          userMessageId,
          assistantMessageId,
          userMessage: parsed.message,
          assistantMessage: fullResponse,
        });
        await episodes.writeEpisode({
          userId: user.id,
          text: parsed.message,
          sourceType: 'tutor_chat',
          sourceId: userMessageId,
          metadata: { sessionId, topic: parsed.topic, subject: parsed.subject },
        });

        await publishTutorProgressEvents({
          userId: user.id,
          sessionId,
          message: parsed.message,
          fullResponse,
          history: recentHistory,
          sessionTurnsCount: tutorTurnsCount,
          mindContext,
          intent: {
            intent: 'TUTOR_SESSION',
            subject: parsed.subject,
            topic: parsed.topic,
          },
          sourceType: 'tutor_chat',
          userMessageId,
          assistantMessageId,
          subject: parsed.subject ?? null,
          chapter: parsed.topic ?? null,
        }).catch((err) => {
          logger.warn('Tutor route progress event publish failed', { userId: user.id, requestId, err });
        });
      } catch (error) {
        logger.error('Tutor stream failed', error, { userId: user.id, requestId });
        controller.enqueue(encoder.encode('\n\n[The tutor hit a temporary issue. Please try again.]'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'x-request-id': requestId,
    },
  });
}
