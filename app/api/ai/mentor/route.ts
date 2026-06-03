import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { streamMentorResponse } from '@/lib/ai/agents/mentor';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { validatePromptLength, usageGateResponse } from '@/lib/utils/billing';
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

const encoder = new TextEncoder();

const MentorPayloadSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.any()).optional().default([]),
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

  const sessionId = await getOrCreateChatSession(supabase, user.id, 'mentor', 'AI Mentor');
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
    bucket: 'mentor',
    maxTokens: 20,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!allowed) return rateLimitResponse(remaining, resetAt);

  let parsed: z.infer<typeof MentorPayloadSchema>;
  try {
    parsed = MentorPayloadSchema.parse(await req.json());
  } catch {
    return apiErrorResponse('invalid_mentor_payload', {
      status: 400,
      message: 'Mentor could not read the request payload.',
      requestId,
    });
  }

  const promptLength = validatePromptLength(parsed.message);
  if (!promptLength.allowed) return usageGateResponse(promptLength);

  const { checkIdempotency } = await import('@/lib/middleware/idempotency');
  const idempotencyKey = req.headers.get('Idempotency-Key');
  const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'mentor_chat', idempotencyKey);
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

  const sessionId = await getOrCreateChatSession(supabase, user.id, 'mentor', 'AI Mentor');
  const persistedHistory = await loadRecentMessages(supabase, sessionId);
  const recentHistory = persistedHistory.length ? persistedHistory : parsed.history.slice(-20);
  const messageRequestId = idempotencyKey || requestId;
  const promptVersion = getPromptVersion('mentor');

  const { id: userMessageId } = await persistChatMessage(supabase, {
    sessionId,
    userId: user.id,
    role: 'user',
    content: parsed.message,
    metadata: { source_type: 'mentor_chat' },
  });
  void inferAndUpdateEmotionalState(user.id, parsed.message).catch(() => {});

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        const { getMaxRecentMessages } = await import('@/lib/ai/cost-mode');
        const { sanitizeHistoryForPrompt } = await import('@/lib/ai/chat-history-sanitizer');
        const { maybeUpdateSessionSummary } = await import('@/lib/ai/session-summary');
        
        const sanitizedHistory = sanitizeHistoryForPrompt(recentHistory, getMaxRecentMessages(), parsed.message);
        void maybeUpdateSessionSummary(user.id, sessionId, recentHistory).catch(() => {});

        for await (const chunk of streamMentorResponse(user.id, parsed.message, sanitizedHistory)) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        const { id: assistantMessageId } = await persistChatMessage(supabase, {
          sessionId,
          userId: user.id,
          role: 'assistant',
          content: fullResponse,
          metadata: { source_type: 'mentor_chat' },
          promptVersion,
          idempotencyKey: `${messageRequestId}:assistant`,
        });

        const memory = new ChatMemoryService();
        const episodes = new EpisodicMemoryService();
        await memory.storeConversationTurnInMemory(user.id, {
          sourceType: 'mentor_chat',
          sessionId,
          userMessageId,
          assistantMessageId,
          userMessage: parsed.message,
          assistantMessage: fullResponse,
        });
        await episodes.writeEpisode({
          userId: user.id,
          text: parsed.message,
          sourceType: 'mentor_chat',
          sourceId: userMessageId,
          metadata: { sessionId },
        });
      } catch (error) {
        logger.error('Mentor stream failed', error, { userId: user.id, requestId });
        controller.enqueue(encoder.encode('\n\n[The mentor hit a temporary issue. Please try again.]'));
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
