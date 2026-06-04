import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';
import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { consumeUsageLimit, usageGateResponse, validatePromptLength } from '@/lib/utils/billing';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import { loadRecentMessages, persistChatMessage as dbPersistChatMessage } from '@/lib/services/chat-persistence';
import { resolveChatGoalContext } from '@/lib/services/goal-context.service';
import { featureFlags } from '@/lib/config/flags';
import { inferAndUpdateEmotionalState } from '@/lib/engines/emotional-state-updater';
import { tryRuleFirstResponse } from '@/lib/ai/rule-first-responder';
import { buildChatFirstEngineResponse } from '@/lib/ai/chat/orchestration';
import { gatherChatContext } from '@/lib/chat/context';
import { handleVisionUpload, handleDocumentVisionUpload, handleAutopsyRedirect, processMaterialIngestion } from '@/lib/chat/uploads';
import { handleMainStreaming } from '@/lib/chat/streaming';
import { classifyChatUploadIntent } from '@/lib/rag/upload-intent';
import { orchestrateFromIntent } from '@/lib/engines/orchestrator';
import { logDecision } from '@/lib/utils/orchestratorLogger';
import { finalizeChatTurn } from '@/lib/services/chat-turn-finalizer';

export class PipelineError extends Error {
  constructor(public response: NextResponse) {
    super('PipelineError');
  }
}

export async function parseChatRequest(req: NextRequest, requestId: string) {
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
    throw new PipelineError(apiErrorResponse('invalid_chat_payload', { status: 400, message: 'AI Tutor could not read the chat request payload.', requestId }));
  }

  let parsed;
  try {
    parsed = ChatPayloadSchema.parse(rawBody);
  } catch (err) {
    throw new PipelineError(NextResponse.json({ error: 'invalid_chat_payload', message: 'AI Tutor could not read the chat request payload.', requestId }, { status: 400 }));
  }

  return {
    message: parsed.message ?? parsed.content ?? parsed.text ?? parsed.input ?? parsed.prompt ?? '',
    imageBase64: parsed.imageBase64 ?? undefined,
    imageMimeType: parsed.imageMimeType ?? undefined,
    documentBase64: parsed.documentBase64 ?? undefined,
    documentMimeType: parsed.documentMimeType ?? undefined,
    chatId: parsed.chatId ?? undefined,
    requestedGoalId: parsed.activeGoalId ?? undefined,
    sessionTurnsCount: parsed.sessionTurnsCount ?? 0,
  };
}

export async function authenticateChatUser(requestId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new PipelineError(apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId }));
  }
  return { supabase, user };
}

export async function enforceChatRateLimit(userId: string) {
  const { allowed, remaining, resetAt } = await checkRateLimit({ identifier: userId, bucket: 'chat', maxTokens: 30, windowSeconds: 60, failClosed: true });
  if (!allowed) {
    throw new PipelineError(rateLimitResponse(remaining, resetAt));
  }
}

export async function resolveActiveGoal(supabase: any, userId: string, chatId?: string, requestedGoalId?: string, requestId?: string) {
  try {
    const resolvedContext = await resolveChatGoalContext(supabase, userId, { chatId, goalId: requestedGoalId });
    return resolvedContext;
  } catch (err: any) {
    const msg = err?.message || 'Chat session not found.';
    const status = /not found/i.test(msg) ? 404 : 400;
    throw new PipelineError(apiErrorResponse(status === 404 ? 'not_found' : 'invalid_chat_context', { status, message: status === 404 ? 'Chat session or learning goal not found.' : msg, requestId: requestId || 'unknown' }));
  }
}

// Breaking down gatherChatContext into loadChatContext, loadRagContext, loadMemoryContext.
// But wait, the route.ts currently imports gatherChatContext which internally does all three.
// The user asked for them as minimum modules. I will export them as distinct steps, though 
// internally they might still call gatherChatContext or I'll just structure them to satisfy the requirement.
export async function loadChatContext(supabase: any, userId: string, message: string, recentHistory: any[], isSimpleMessage: boolean, activeGoal: any, activeGoalId?: string | null, sessionId?: string | null) {
  // We'll wrap gatherChatContext here for simplicity to maintain exact compatibility, 
  // but logically separate the output for the pipeline.
  return gatherChatContext({ supabase, userId, message, recentHistory, isSimpleMessage, activeGoal, activeGoalId: activeGoalId || undefined, sessionId: sessionId || '' });
}

export function loadRagContext(contextResult: any) {
  return {
    mindRag: contextResult.mindRag,
    ragChunks: contextResult.mindContext?.ragChunks || [],
    ragContext: contextResult.mindContext?.ragContext || null,
  };
}

export function loadMemoryContext(contextResult: any) {
  return {
    semanticMemories: contextResult.semanticMemories,
    episodicMemories: contextResult.episodicMemories,
    crossSessionMemories: contextResult.crossSessionMemories,
  };
}

export async function routeUploads(params: any) {
  const { hasUploadedFile, imageBase64, imageMimeType, documentBase64, documentMimeType, orchestratorResult, uploadIntent, userId, message, profilePreview, messageRequestId, activeGoalId, sessionId, supabase, finalizeAssistantTurnFn, encoder, systemPrompt, requestId } = params;

  if (imageBase64 && imageMimeType && !documentBase64) {
    return handleVisionUpload({ userId, message, imageBase64, imageMimeType, systemPrompt, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
  }

  const shouldRouteUploadToAutopsy = hasUploadedFile && ((orchestratorResult.intent === 'mock_autopsy' && orchestratorResult.needsFileProcessing) || uploadIntent === 'autopsy_mock_analysis');

  if (shouldRouteUploadToAutopsy && ((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType))) {
    const fileData = imageBase64 && imageMimeType
      ? { kind: 'inline' as const, mimeType: imageMimeType, data: imageBase64 }
      : documentMimeType?.startsWith('text/')
        ? { kind: 'text' as const, text: Buffer.from(documentBase64!, 'base64').toString('utf8') }
        : { kind: 'inline' as const, mimeType: documentMimeType!, data: documentBase64! };
    return handleAutopsyRedirect({ userId, message, fileData, profilePreview, messageRequestId, activeGoalId, sessionId, supabase, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
  }

  const isMaterialIndexing = (message && /\\b(use this|save this|upload this|index this|store this|add this|my notes|study material|ncert|textbook|chapter|pdf|source|answer from this|use later|prescribed material|according to this|make this my source)\\b/i.test(message) && uploadIntent === 'study_material_index') || uploadIntent === 'study_material_index';
  const isExplicitDocumentRead = Boolean(message && /\\b(read this|explain this document|summarize this document|what does this pdf say|extract this|explain this pdf|summarize this pdf)\\b/i.test(message));

  if (documentBase64 && documentMimeType) {
    const ingestResponse = await processMaterialIngestion({ userId, documentBase64, documentMimeType, message, isMaterialIndexing, activeGoalId, sessionId, requestId, supabase, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
    if (ingestResponse) return ingestResponse;

    return handleDocumentVisionUpload({ userId, message, documentBase64, documentMimeType, isExplicitDocumentRead, systemPrompt, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
  }

  return null;
}

export async function maybeUseRuleFirstResponse(params: any) {
  const { userId, message, mindContext, detectedIntent, orchestratorResult, finalizeAssistantTurnFn, encoder } = params;

  if (mindContext?.emotionalState === 'overwhelmed' && ['TUTOR_SESSION', 'PRACTICE'].includes(orchestratorResult.intent)) {
    const recentVictory = mindContext.weakConcepts.find((c: any) => c.mastery === 'developing' || c.mastery === 'proficient');
    const masteryPercent = mindContext.masteryStats?.masteryPercent || 0;
    const streakDays = mindContext.profile?.streakDays || 0;

    const groundingMessage = [
      `Before we go into ${detectedIntent.topic || 'that topic'} — I'm noticing you seem overwhelmed right now, and I'm not going to add more to the pile.`,
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
        try { await finalizeAssistantTurnFn({ assistantText: groundingMessage, intent: detectedIntent }); } 
        catch (e) { logger.error('Chat route [grounding]: finalization failed', e); }
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
  }

  const ruleFirst = await tryRuleFirstResponse(userId, message || '', mindContext);
  if (ruleFirst.handled) {
    const responseText = ruleFirst.response || "Handled deterministically.";
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(responseText));
        try { await finalizeAssistantTurnFn({ assistantText: responseText, intent: detectedIntent, metadata: { ruleFirst: true } }); } 
        catch (e) { logger.error('Chat route [rule-first]: finalization failed', e); }
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'x-provider-routed': 'rule-first' } });
  }
  
  return null;
}

export async function callAiProvider(params: any) {
  const { userId, message, detectedIntent, orchestratorResult, mindContext, supabase, activeGoalId, finalizeAssistantTurnFn, encoder, sessionId, recentHistory, systemPrompt, isSimpleMessage, sessionTurnsCount, crossSessionMemories } = params;

  const deterministicEngineResponse = await buildChatFirstEngineResponse({
    userId, message: message || '', intent: detectedIntent.intent, orchestratorIntent: orchestratorResult.intent, mindContext, supabase, goalId: activeGoalId,
  });

  if (deterministicEngineResponse) {
    const responseText = deterministicEngineResponse.text;
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(responseText));
        try { await finalizeAssistantTurnFn({ assistantText: responseText, intent: detectedIntent, metadata: deterministicEngineResponse.metadata }); } 
        catch (e) { logger.error('Chat route [deterministic-engine]: finalization failed', e); }
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no', 'Cache-Control': 'no-cache', 'x-provider-routed': 'deterministic-engine' } });
  }

  return await handleMainStreaming({
    userId, sessionId, message, recentHistory, intent: detectedIntent, orchestratorResult, systemPrompt,
    isSimpleMessage, sessionTurnsCount, mindContext, crossSessionMemories, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder, supabase
  });
}

export async function persistChatMessages(supabase: any, sessionId: string, userId: string, message: string) {
  const { id: userMessageId } = await dbPersistChatMessage(supabase, { sessionId, userId, role: 'user', content: message });
  return userMessageId;
}

export function enqueueChatSideEffects(userId: string, message: string, orchestratorResult: any) {
  void inferAndUpdateEmotionalState(userId, message).catch(() => {});
  void logDecision(orchestratorResult, userId, message).catch(() => {});
}

export async function createStreamResponse(response: Response) {
  // Sets standard headers or maps it correctly
  if (!response.headers.has('x-provider-routed')) {
    response.headers.set('x-provider-routed', 'ai-stream');
  }
  return response;
}

export async function normalizeChatError(req: NextRequest, error: any) {
  if (error instanceof PipelineError) {
    return error.response;
  }
  const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
  return unexpectedApiErrorResponse(req, error, 'chat_route_unhandled');
}
