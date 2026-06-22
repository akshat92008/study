export const maxDuration = 60;
// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { loadRecentMessagesForClient } from '@/lib/services/chat-persistence';
import { resolveChatGoalContext } from '@/lib/services/goal-context.service';

import {
  PipelineError,
  parseChatRequest,
  authenticateChatUser,
  enforceChatRateLimit,
  resolveActiveGoal,
  loadChatContext,
  loadRagContext,
  loadMemoryContext,
  routeUploads,
  maybeUseRuleFirstResponse,
  callAiProvider,
  persistChatMessages,
  enqueueChatSideEffects,
  createStreamResponse,
  normalizeChatError
} from '@/lib/chat/pipeline';

import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { loadRecentMessages } from '@/lib/services/chat-persistence';
import { consumeUsageLimit, usageGateResponse, validatePromptLength } from '@/lib/utils/billing';
import { classifyChatUploadIntent } from '@/lib/rag/upload-intent';
import { orchestrateFromIntent } from '@/lib/engines/orchestrator';
import { finalizeChatTurn } from '@/lib/services/chat-turn-finalizer';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import { betaAccessErrorResponse, requireActiveBetaUser } from '@/lib/access/beta-access';
import { featureDisabledResponse, isFeatureEnabled } from '@/lib/feature-registry';

const encoder = new TextEncoder();

export async function GET(request?: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }
    try {
      await requireActiveBetaUser(user.id);
    } catch (accessError) {
      return betaAccessErrorResponse(accessError, requestId) ?? apiErrorResponse('beta_access_required', {
        status: 403,
        message: 'Cognition OS is currently in a limited beta. Ask the admin to activate your beta access.',
        requestId,
      });
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
    const requestId = getRequestId(req);
    
    // 1. Authenticate & Rate Limit
    const { supabase, user } = await authenticateChatUser(requestId);
    try {
      await requireActiveBetaUser(user.id);
    } catch (accessError) {
      const response = betaAccessErrorResponse(accessError, requestId);
      if (response) throw new PipelineError(response);
      throw accessError;
    }
    logger.info('Chat request started', { userId: user.id, requestId, feature: 'chat' });
    await enforceChatRateLimit(user.id);

    // 2. Parse Request
    const parsedRequest = await parseChatRequest(req, requestId);
    const isTutorRoute = new URL(req.url).pathname.endsWith('/api/ai/tutor');
    const { message, imageBase64, imageMimeType, documentBase64, documentMimeType, chatId, requestedGoalId, exam, subject, chapterSlug, topicSlug } = parsedRequest;
    const tutorSurface = parsedRequest.tutorSurface || isTutorRoute;
    let { sessionTurnsCount } = parsedRequest;

    // 3. Resolve Active Goal
    const resolvedContext = await resolveActiveGoal(supabase, user.id, chatId, requestedGoalId, requestId);
    const { sessionId, goal: activeGoal, goalId: activeGoalId, session: sessionData } = resolvedContext;

    // Optional Title Update
    if (sessionData.title === 'New Chat') {
      const titleContent = activeGoal?.title || message || (imageBase64 ? 'Image question' : documentBase64 ? 'Document analysis' : 'New Chat');
      const newTitle = titleContent.length > 44 ? titleContent.substring(0, 44) + '...' : titleContent;
      if (newTitle !== 'New Chat') {
        void supabase.from('chat_sessions').update({ title: newTitle }).eq('id', sessionId).eq('user_id', user.id).then(({ error }) => {
          if (error) logger.warn('Chat title update failed', { error, sessionId });
        });
      }
    }

    // Validate Uploads & Features
    if (imageBase64) {
      const imgValidation = validateBase64Payload(imageBase64, imageMimeType);
      if (!imgValidation.valid) throw new PipelineError(imgValidation.error!);
    }
    if (documentBase64) {
      const docValidation = validateBase64Payload(documentBase64, documentMimeType);
      if (!docValidation.valid) throw new PipelineError(docValidation.error!);
    }
    // Persisted History & Idempotency
    const persistedHistory = await loadRecentMessages(supabase, sessionId);
    const recentHistory = persistedHistory.slice(-50);
    sessionTurnsCount = Math.max(sessionTurnsCount, recentHistory.filter((turn: any) => turn?.role === 'user').length + 1);

    const userMessageForPersistence = message || (imageBase64 ? '[Image question]' : documentBase64 ? '[Document upload]' : '');
    if (!userMessageForPersistence.trim()) {
      throw new PipelineError(apiErrorResponse('invalid_request', { status: 400, message: 'Message or upload is required.', requestId }));
    }

    const { checkIdempotency } = await import('@/lib/middleware/idempotency');
    const idempotencyKey = req.headers.get('Idempotency-Key');
    const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'chat', idempotencyKey);
    if (idempError) throw new PipelineError(apiErrorResponse('invalid_idempotency_key', { status: 400, message: idempError, requestId }));
    if (isDuplicate) throw new PipelineError(apiErrorResponse('duplicate_request', { status: 409, message: 'Duplicate request.', requestId }));

    const messageRequestId = idempotencyKey || requestId;

    // Billing & Usage Gates
    const promptLength = validatePromptLength(userMessageForPersistence);
    if (!promptLength.allowed) throw new PipelineError(usageGateResponse(promptLength));

    const { enforceFeatureLimit, featureLimitResponse } = await import('@/lib/usage/enforce-feature-limit');
    try {
      await enforceFeatureLimit(user.id, 'chat_message');
    } catch (err: any) {
      if (err.check) {
        throw new PipelineError(featureLimitResponse(err.check, requestId));
      }
      throw err;
    }

    // 4. Persist User Message
    const userMessageId = await persistChatMessages(supabase, sessionId, user.id, userMessageForPersistence);

    // 5. Load Core Context
    const cleanMsg = (message || '').trim().toLowerCase();
    const isSimpleMessage = cleanMsg === 'hi' || cleanMsg === 'hello' || cleanMsg === 'hey' || cleanMsg === 'ok' || cleanMsg === 'thanks' || cleanMsg === 'thank you';
    const { selectedMaterialIds } = parsedRequest;
    
    const contextResult = await loadChatContext(supabase, user.id, message, recentHistory, isSimpleMessage, activeGoal, activeGoalId, sessionId, selectedMaterialIds, tutorSurface, exam, subject, chapterSlug, topicSlug);
    const { profilePreview, detectedIntent, emotion, mindContext, systemPrompt } = contextResult;
    const effectiveIntent = tutorSurface
      ? { ...detectedIntent, intent: 'TUTOR_SESSION', topic: detectedIntent.topic ?? activeGoal?.title ?? undefined }
      : detectedIntent;
    
    // 6. Load Specialized Contexts
    const { mindRag, ragChunks, ragContext } = loadRagContext(contextResult);
    const { semanticMemories, episodicMemories, crossSessionMemories } = loadMemoryContext(contextResult);

    // 7. Orchestration & Intents
    const hasUploadedFile = !!((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType));
    const orchestratorResult = tutorSurface
      ? { intent: 'tutor_session', mode: 'learning', requiredWorkers: [], shouldAnswerFirst: true, needsFileProcessing: hasUploadedFile, riskLevel: 'low' as const }
      : orchestrateFromIntent(effectiveIntent, hasUploadedFile, message || '');
    
    // 8. Enqueue Side Effects
    try {
      enqueueChatSideEffects(user.id, userMessageForPersistence, orchestratorResult);
    } catch (e) {
      logger.warn('[chat.side_effect_failed]', { error: e });
    }

    const promptVersion = getPromptVersion('mind');
    const finalizeAssistantTurnFn = (input: any) => finalizeChatTurn({
      supabase, userId: user.id, sessionId, goalId: activeGoalId,
      userMessage: input.userMessage ?? message ?? '', userMessageId, assistantText: input.assistantText,
      metadata: { ...(input.metadata || {}), ...(mindContext?.ragChunks?.length ? { ragChunks: mindContext.ragChunks } : {}) },
      intent: input.intent ?? effectiveIntent, emotion, promptVersion, idempotencyKey: messageRequestId,
      recentHistory, sessionTurnsCount, mindContext,
      budgetReservationId: input.budgetReservationId, budgetUsage: input.budgetUsage, onBudgetSettled: input.onBudgetSettled,
    });

    const uploadIntent = hasUploadedFile ? classifyChatUploadIntent({ message: message || '', mimeType: (imageMimeType || documentMimeType || undefined) as string | undefined }) : 'unsupported';

    // 9. Route Uploads (if any)


    const uploadResponse = await routeUploads({
      hasUploadedFile, imageBase64, imageMimeType, documentBase64, documentMimeType, orchestratorResult, uploadIntent, userId: user.id, message, profilePreview, messageRequestId, activeGoalId: activeGoalId ?? undefined, sessionId, supabase, finalizeAssistantTurnFn, encoder, systemPrompt, requestId
    });
    if (uploadResponse) return uploadResponse;

    // 10. Check Rule-First Engine (Overwhelmed / Grounding)
    const ruleResponse = await maybeUseRuleFirstResponse({
      userId: user.id, message, mindContext, detectedIntent: effectiveIntent, orchestratorResult, finalizeAssistantTurnFn, encoder
    });
    if (ruleResponse) return ruleResponse;



    const { consumeFeatureUsage } = await import('@/lib/usage/enforce-feature-limit');
    await consumeFeatureUsage(user.id, 'chat_message', 1, { idempotencyKey: messageRequestId });

    if (mindContext?.ragChunks?.length > 0) {
      await consumeFeatureUsage(user.id, 'material_query', 1, {
        idempotencyKey: `rag_query_chat:${messageRequestId}`,
      }).catch(err => {
        logger.error('Failed to consume material_query usage in chat', err);
      });
    }

    // 11. Call AI Provider (Deterministic or LLM Stream)
    if (!isFeatureEnabled('ai_global')) {
      return featureDisabledResponse(requestId);
    }
    const providerResponse = await callAiProvider({
      userId: user.id, message, detectedIntent: effectiveIntent, orchestratorResult, mindContext, supabase, activeGoalId: activeGoalId ?? undefined, finalizeAssistantTurnFn, encoder, sessionId, recentHistory, systemPrompt, isSimpleMessage, sessionTurnsCount, crossSessionMemories
    });

    // 12. Format & Return Stream Response
    return await createStreamResponse(providerResponse);

  } catch (error) {
    // 13. Normalize Errors
    return normalizeChatError(req, error);
  }
}
