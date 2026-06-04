export const maxDuration = 60;
// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';
import { orchestrateFromIntent } from '@/lib/engines/orchestrator';
import { logDecision } from '@/lib/utils/orchestratorLogger';
import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { classifyChatUploadIntent } from '@/lib/rag/upload-intent';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { consumeUsageLimit, usageGateResponse, validatePromptLength } from '@/lib/utils/billing';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import { loadRecentMessagesForClient, loadRecentMessages, persistChatMessage } from '@/lib/services/chat-persistence';
import { resolveChatGoalContext } from '@/lib/services/goal-context.service';
import { finalizeChatTurn } from '@/lib/services/chat-turn-finalizer';
import { featureFlags } from '@/lib/config/flags';
import { inferAndUpdateEmotionalState } from '@/lib/engines/emotional-state-updater';
import { tryRuleFirstResponse } from '@/lib/ai/rule-first-responder';
import { buildChatFirstEngineResponse } from '@/lib/ai/chat/orchestration';

// Newly extracted modules:
import { gatherChatContext } from '@/lib/chat/context';
import { handleVisionUpload, handleDocumentVisionUpload, handleAutopsyRedirect, processMaterialIngestion } from '@/lib/chat/uploads';
import { handleMainStreaming } from '@/lib/chat/streaming';

const encoder = new TextEncoder();
const STUDY_MATERIAL_UPLOAD_RE = /\\b(use this|save this|upload this|index this|store this|add this|my notes|study material|ncert|textbook|chapter|pdf|source|answer from this|use later|prescribed material|according to this|make this my source)\\b/i;
const EXPLICIT_READ = /\\b(read this|explain this document|summarize this document|what does this pdf say|extract this|explain this pdf|summarize this pdf)\\b/i;

export async function GET(request?: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const url = request ? new URL(request.url) : null;
    const chatId = url?.searchParams.get('chatId');
    const activeGoalId = url?.searchParams.get('activeGoalId');
    const resolved = await resolveChatGoalContext(supabase, user.id, { chatId, goalId: activeGoalId });
    const sessionId = resolved.sessionId;
    const messages = await loadRecentMessagesForClient(supabase, sessionId);

    return NextResponse.json({
      sessionId,
      goalId: resolved.goalId,
      goal: resolved.goal,
      messages,
    }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to hydrate global chat', error, { requestId, feature: 'chat' });
    return apiErrorResponse('chat_hydration_failed', { status: 500, message: 'Unable to load AI Tutor chat history.', requestId });
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
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    logger.info('Chat request started', { userId: user.id, requestId, feature: 'chat' });

    const { allowed, remaining, resetAt } = await checkRateLimit({ identifier: user.id, bucket: 'chat', maxTokens: 30, windowSeconds: 60, failClosed: true });
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
    try { rawBody = await req.json(); } catch (jsonErr) {
      return apiErrorResponse('invalid_chat_payload', { status: 400, message: 'AI Tutor could not read the chat request payload.', requestId });
    }

    let parsed;
    try { parsed = ChatPayloadSchema.parse(rawBody); } catch (err) {
      return NextResponse.json({ error: 'invalid_chat_payload', message: 'AI Tutor could not read the chat request payload.', requestId }, { status: 400 });
    }

    const message = parsed.message ?? parsed.content ?? parsed.text ?? parsed.input ?? parsed.prompt ?? '';
    const imageBase64 = parsed.imageBase64 ?? undefined;
    const imageMimeType = parsed.imageMimeType ?? undefined;
    const documentBase64 = parsed.documentBase64 ?? undefined;
    const documentMimeType = parsed.documentMimeType ?? undefined;
    const chatId = parsed.chatId ?? undefined;
    const requestedGoalId = parsed.activeGoalId ?? undefined;
    let sessionTurnsCount = parsed.sessionTurnsCount ?? 0;
    const promptVersion = getPromptVersion('mind');
    
    let resolvedContext;
    try {
      resolvedContext = await resolveChatGoalContext(supabase, user.id, { chatId, goalId: requestedGoalId });
    } catch (err: any) {
      const msg = err?.message || 'Chat session not found.';
      const status = /not found/i.test(msg) ? 404 : 400;
      return apiErrorResponse(status === 404 ? 'not_found' : 'invalid_chat_context', { status, message: status === 404 ? 'Chat session or learning goal not found.' : msg, requestId });
    }

    const sessionId = resolvedContext.sessionId;
    const activeGoal = resolvedContext.goal;
    const activeGoalId = resolvedContext.goalId;
    const sessionData = resolvedContext.session;
      
    if (sessionData.title === 'New Chat') {
      const titleContent = activeGoal?.title || message || (imageBase64 ? 'Image question' : documentBase64 ? 'Document analysis' : 'New Chat');
      const newTitle = titleContent.length > 44 ? titleContent.substring(0, 44) + '...' : titleContent;
      if (newTitle !== 'New Chat') {
        supabase.from('chat_sessions').update({ title: newTitle }).eq('id', sessionId).eq('user_id', user.id).then();
      }
    }

    if (imageBase64) {
      const imgValidation = validateBase64Payload(imageBase64, imageMimeType);
      if (!imgValidation.valid) return imgValidation.error!;
    }
    if (documentBase64) {
      const docValidation = validateBase64Payload(documentBase64, documentMimeType);
      if (!docValidation.valid) return docValidation.error!;
    }
    if ((imageBase64 || documentBase64) && !featureFlags.visionUploads()) {
      return NextResponse.json({ error: 'Vision uploads are temporarily disabled for beta stability.' }, { status: 503 });
    }

    const persistedHistory = await loadRecentMessages(supabase, sessionId);
    const recentHistory = persistedHistory.slice(-50);
    sessionTurnsCount = Math.max(sessionTurnsCount, recentHistory.filter((turn: any) => turn?.role === 'user').length + 1);

    const userMessageForPersistence = message || (imageBase64 ? '[Image question]' : documentBase64 ? '[Document upload]' : '');
    if (!userMessageForPersistence.trim()) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Message or upload is required.', requestId });
    }

    const { checkIdempotency } = await import('@/lib/middleware/idempotency');
    const idempotencyKey = req.headers.get('Idempotency-Key');
    const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'chat', idempotencyKey);
    if (idempError) return apiErrorResponse('invalid_idempotency_key', { status: 400, message: idempError, requestId });
    if (isDuplicate) return apiErrorResponse('duplicate_request', { status: 409, message: 'Duplicate request.', requestId });

    const messageRequestId = idempotencyKey || requestId;

    const promptLength = validatePromptLength(userMessageForPersistence);
    if (!promptLength.allowed) return usageGateResponse(promptLength);

    const usageGate = await consumeUsageLimit(user.id, 'chat_messages_daily');
    if (!usageGate.allowed) return usageGateResponse(usageGate);
    const hourlyGate = await consumeUsageLimit(user.id, 'chat_messages_hourly');
    if (!hourlyGate.allowed) return usageGateResponse(hourlyGate);

    const { id: userMessageId } = await persistChatMessage(supabase, { sessionId, userId: user.id, role: 'user', content: userMessageForPersistence });
    void inferAndUpdateEmotionalState(user.id, userMessageForPersistence).catch(() => {});

    // ============================================================================
    // STAGE 2-4: CONTEXT HYDRATION & INTENT
    // ============================================================================
    const cleanMsg = (message || '').trim().toLowerCase();
    const isSimpleMessage = cleanMsg === 'hi' || cleanMsg === 'hello' || cleanMsg === 'hey' || cleanMsg === 'ok' || cleanMsg === 'thanks' || cleanMsg === 'thank you';

    const {
      profilePreview, detectedIntent, emotion, semanticMemories, episodicMemories,
      mindContext, mindRag, crossSessionMemories, systemPrompt
    } = await gatherChatContext({ supabase, userId: user.id, message, recentHistory, isSimpleMessage, activeGoal, activeGoalId, sessionId });

    const hasUploadedFile = !!((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType));
    const orchestratorResult = orchestrateFromIntent(detectedIntent, hasUploadedFile, message || '');
    await logDecision(orchestratorResult, user.id, message || '').catch(() => {});

    const finalizeAssistantTurnFn = (input: any) => finalizeChatTurn({
      supabase, userId: user.id, sessionId, goalId: activeGoalId,
      userMessage: input.userMessage ?? message ?? '', userMessageId, assistantText: input.assistantText,
      metadata: { ...(input.metadata || {}), ...(mindContext?.ragChunks?.length ? { ragChunks: mindContext.ragChunks } : {}) },
      intent: input.intent ?? detectedIntent, emotion, promptVersion, idempotencyKey: messageRequestId,
      recentHistory, sessionTurnsCount, mindContext,
      budgetReservationId: input.budgetReservationId, budgetUsage: input.budgetUsage, onBudgetSettled: input.onBudgetSettled,
    });

    // ============================================================================
    // STAGE 5: AI ORCHESTRATION & STREAMING
    // ============================================================================

    if (imageBase64 && imageMimeType) {
      return handleVisionUpload({ userId: user.id, message, imageBase64, imageMimeType, systemPrompt, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
    }

    const uploadIntent = hasUploadedFile ? classifyChatUploadIntent({ message: message || '', mimeType: imageMimeType || documentMimeType }) : 'unsupported';
    const shouldRouteUploadToAutopsy = hasUploadedFile && ((orchestratorResult.intent === 'mock_autopsy' && orchestratorResult.needsFileProcessing) || uploadIntent === 'autopsy_mock_analysis');

    if (shouldRouteUploadToAutopsy && ((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType))) {
      const fileData = imageBase64 && imageMimeType
        ? { kind: 'inline' as const, mimeType: imageMimeType, data: imageBase64 }
        : documentMimeType?.startsWith('text/')
          ? { kind: 'text' as const, text: Buffer.from(documentBase64!, 'base64').toString('utf8') }
          : { kind: 'inline' as const, mimeType: documentMimeType!, data: documentBase64! };
      return handleAutopsyRedirect({ userId: user.id, message, fileData, profilePreview, messageRequestId, activeGoalId, sessionId, supabase, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
    }

    const isMaterialIndexing = (message && STUDY_MATERIAL_UPLOAD_RE.test(message) && uploadIntent === 'study_material_index') || uploadIntent === 'study_material_index';
    const isExplicitDocumentRead = Boolean(message && EXPLICIT_READ.test(message));

    if (documentBase64 && documentMimeType) {
      const ingestResponse = await processMaterialIngestion({ userId: user.id, documentBase64, documentMimeType, message, isMaterialIndexing, activeGoalId, sessionId, requestId, supabase, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
      if (ingestResponse) return ingestResponse;

      return handleDocumentVisionUpload({ userId: user.id, message, documentBase64, documentMimeType, isExplicitDocumentRead, systemPrompt, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder });
    }

    // Branch C: Overwhelmed / emotional grounding
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
      ].filter(Boolean).join('\
');

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

    const ruleFirst = await tryRuleFirstResponse(user.id, message || '', mindContext);
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

    const deterministicEngineResponse = await buildChatFirstEngineResponse({
      userId: user.id, message: message || '', intent: detectedIntent.intent, orchestratorIntent: orchestratorResult.intent, mindContext, supabase, goalId: activeGoalId,
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

    const response = await handleMainStreaming({
      userId: user.id, sessionId, message, recentHistory, intent: detectedIntent, orchestratorResult, systemPrompt,
      isSimpleMessage, sessionTurnsCount, mindContext, crossSessionMemories, finalizeAssistantTurn: finalizeAssistantTurnFn, encoder, supabase
    });

    response.headers.set('x-provider-routed', 'ai-stream');
    return response;

  } catch (error) {
    const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
    return unexpectedApiErrorResponse(req, error, 'chat_route_unhandled');
  }
}
