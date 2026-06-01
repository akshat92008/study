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
import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { EpisodicMemoryService } from '@/lib/services/episodic-memory.service';
import { buildConversationMessages } from '@/lib/ai/chat-intent';
import { classifyMessageCombined } from '@/lib/ai/chat-intent-with-emotion';
import { inferAndUpdateEmotionalState } from '@/lib/engines/emotional-state-updater';
import { validateBase64Payload } from '@/lib/middleware/validateUpload';
import { classifyChatUploadIntent } from '@/lib/rag/upload-intent';
import { createAutopsyJob } from '@/lib/services/autopsy-jobs';
import { checkSemanticCache, setSemanticCache, isCacheable } from '@/lib/ai/responseCache';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { consumeUsageLimit, usageGateResponse, validatePromptLength } from '@/lib/utils/billing';
import { getPromptVersion } from '@/lib/ai/prompt-version';
import {
  budgetExceededResponse,
  budgetUnavailableResponse,
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
} from '@/lib/services/chat-persistence';
import { finalizeChatTurn } from '@/lib/services/chat-turn-finalizer';
import { ChatTutorService } from '@/lib/services/chat-tutor.service';
import {
  ensureCommandPlanForDate,
  formatCommandPlanForChat,
  formatRevisionQueueForChat,
  formatWeakAreasForChat,
  localDateAfter,
} from '@/lib/services/command-plan.service';
import { generateJSON } from '@/lib/ai/provider-client';
import { DailyMicrotaskService } from '@/lib/services/daily-microtask.service';
import { buildMindRagContext } from '@/lib/rag/mind-rag';
import { ingestStudyMaterial, materialContentHash } from '@/lib/rag/ingest';
import { SUPPORTED_MATERIAL_MIME_TYPES } from '@/lib/rag/config';
const encoder = new TextEncoder();
const STUDY_MATERIAL_UPLOAD_RE =
  /\b(use this|save this|upload this|index this|store this|add this|my notes|study material|ncert|textbook|chapter|pdf|source|answer from this|use later|prescribed material|according to this|make this my source)\b/i;
const EXPLICIT_READ =
  /\b(read this|explain this document|summarize this document|what does this pdf say|extract this|explain this pdf|summarize this pdf)\b/i;

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

    const url = request ? new URL(request.url) : null;
    const chatId = url?.searchParams.get('chatId');

    let sessionId = chatId;
    if (!sessionId) {
      sessionId = await getOrCreateGlobalChatSession(supabase, user.id);
    } else {
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();
      if (sessionError || !sessionData) {
        return apiErrorResponse('not_found', { status: 404, message: 'Chat session not found.', requestId });
      }
    }

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
    let sessionTurnsCount = parsed.sessionTurnsCount ?? 0;
    const promptVersion = getPromptVersion('mind');
    
    let sessionId = chatId;
    if (!sessionId) {
      sessionId = await getOrCreateGlobalChatSession(supabase, user.id);
    } else {
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('id, title')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();
        
      if (!sessionData) {
        return apiErrorResponse('not_found', { status: 404, message: 'Chat session not found.', requestId });
      }
      
      if (sessionData.title === 'New Chat') {
        const titleContent = message || (parsed.imageBase64 ? 'Image question' : parsed.documentBase64 ? 'Document analysis' : 'New Chat');
        const newTitle = titleContent.length > 30 ? titleContent.substring(0, 30) + '...' : titleContent;
        if (newTitle !== 'New Chat') {
          supabase.from('chat_sessions').update({ title: newTitle }).eq('id', sessionId).then();
        }
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

    const persistedHistory = await loadRecentMessages(supabase, sessionId);
    const recentHistory = persistedHistory.slice(-50);
    sessionTurnsCount = Math.max(
      sessionTurnsCount,
      recentHistory.filter((turn: any) => turn?.role === 'user').length + 1
    );

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

    const mindRagPromise = buildMindRagContext({
      userId: user.id,
      message: message || '',
      subject: detectedIntent.subject || undefined,
      chapter: detectedIntent.topic || undefined,
    }).catch((err) => {
      logger.error('Failed to get RAG context', err);
      return { ragContext: null, ragPromptBlock: '' };
    });

    const [semanticMemories, episodicMemories, mindContext, mindRag] = await Promise.all([
      Promise.race([memoryPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => [] as string[]),
      Promise.race([episodicMemoryPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => [] as string[]),
      Promise.race([mindContextPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 1000))]).catch(() => ({
        profile: { name: 'Student', examType: 'General Study', examDate: null, currentLevel: 'intermediate', learningStyle: 'visual', streakDays: 0, timezone: 'UTC', learnerStateVersion: 0 },
        activeGoal: null,
        currentSessionCard: null,
        commandTasks: [],
        recentStudySessions: [],
        weakConcepts: [], recentMistakes: [], struggles: [],
        masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
        overdueCardsCount: 0, topOverdueCards: [], emotionalState: 'neutral', recentTopics: [], knownAnalogies: [],
        conceptHistory: [],
        cognitiveLoad: { level: 'normal', signals: [] },
        rootGapChains: [],
        currentSessionDurationMinutes: 0,
        sessionGoal: '',
        ragChunks: [],
        ragContext: null,
        studentModel: null,
        outcomeAnalytics: null,
      })),
      Promise.race([mindRagPromise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2000))]).catch(() => ({ ragContext: null, ragPromptBlock: '' }))
    ]) as [string[], string[], any, any];

    const crossSessionMemories = [
      ...episodicMemories.map((memory) => `Episode: ${memory}`),
      ...semanticMemories,
    ].slice(0, 4);
    let systemPrompt = getMINDSystemPrompt(mindContext, crossSessionMemories, detectedIntent.intent);

    const RAG_GROUNDING_RULES = `
SOURCE-GROUNDED STUDY MATERIAL RULES:
- Uploaded sources are grounding evidence, not decoration.
- If SOURCE-GROUNDED MODE is explicit, answer from the retrieved source chunks first.
- If explicit mode has no chunks, say: "I could not find this in your uploaded material." Then optionally provide a general answer separately if helpful.
- If SOURCE-GROUNDED MODE is implicit, use source chunks to improve accuracy when relevant, but answer naturally.
- Never invent citations.
- Cite only the provided source chunks.
- Use compact citations like [Source 1], [Source 2].
- Do not quote long copyrighted passages. Summarize/paraphrase unless a short exact phrase is necessary.
- For NCERT/NEET, prefer NCERT wording/facts when source chunks are available.
- For flashcards/MCQs generated from sources, mention that they are source-grounded and cite the source briefly.
`;

    if (mindRag?.ragPromptBlock) {
      systemPrompt += `\n\n${RAG_GROUNDING_RULES}\n\n${mindRag.ragPromptBlock}`;
      mindContext.ragContext = mindRag.ragContext;
      mindContext.ragChunks = mindRag.ragContext?.chunks || [];
    }

    const hasUploadedFile = !!((imageBase64 && imageMimeType) || (documentBase64 && documentMimeType));
    const orchestratorResult = orchestrateFromIntent(
      detectedIntent,
      hasUploadedFile,
      message || ''
    );
    await logDecision(orchestratorResult, user.id, message || '').catch(() => {});

    const finalizeAssistantTurn = (input: {
      assistantText: string;
      userMessage?: string;
      metadata?: Record<string, any> | null;
      intent?: any;
      budgetReservationId?: string | null;
      budgetUsage?: {
        promptTokens: number;
        completionTokens: number;
        route: string;
        promptVersion?: string;
        promptFamily?: string;
        promptSource?: string;
      } | null;
      onBudgetSettled?: () => void;
    }) => finalizeChatTurn({
      supabase,
      userId: user.id,
      sessionId,
      userMessage: input.userMessage ?? message ?? '',
      userMessageId,
      assistantText: input.assistantText,
      metadata: {
        ...(input.metadata || {}),
        ...(mindContext?.ragChunks?.length ? { ragChunks: mindContext.ragChunks } : {})
      },
      intent: input.intent ?? detectedIntent,
      emotion,
      promptVersion,
      idempotencyKey: messageRequestId,
      recentHistory,
      sessionTurnsCount,
      mindContext,
      budgetReservationId: input.budgetReservationId,
      budgetUsage: input.budgetUsage,
      onBudgetSettled: input.onBudgetSettled,
    });

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

          try {
            await finalizeAssistantTurn({
              assistantText: answer,
              userMessage: message || '[Image question]',
              budgetReservationId: budgetSettled ? null : imageBudget.reservationId,
              budgetUsage: budgetSettled ? null : {
                promptTokens: estimateTextTokens(systemPrompt, message || '[Image question]') + 1200,
                completionTokens: estimateTextTokens(answer),
                route: '/api/ai/chat',
                promptVersion,
                promptFamily: 'mind_chat',
                promptSource: 'chat_image',
              },
              onBudgetSettled: () => {
                budgetSettled = true;
              },
            });
          } catch (finalizeErr) {
            logger.error('Chat route [image]: finalization failed', finalizeErr);
            controller.close();
            return;
          }

          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // ── Branch B: File Upload Routing via Intent ───────────────────────────────────
    const uploadIntent = hasUploadedFile 
      ? classifyChatUploadIntent({
          message: message || '',
          mimeType: imageMimeType || documentMimeType,
        })
      : 'unsupported';

    const shouldRouteUploadToAutopsy =
      hasUploadedFile &&
      (
        (orchestratorResult.intent === 'mock_autopsy' && orchestratorResult.needsFileProcessing) ||
        uploadIntent === 'autopsy_mock_analysis'
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

          try {
            await finalizeAssistantTurn({
              assistantText: responseText,
              userMessage: message || '[Autopsy upload]',
              metadata: { action: 'run_autopsy', jobId: job.id, status: job.status },
            });
          } catch (finalizeErr) {
            logger.error('Chat route [autopsy-redirect]: finalization failed', finalizeErr);
            controller.close();
            return;
          }

          controller.close();
        }
      });

      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const isMaterialIndexing = (message && STUDY_MATERIAL_UPLOAD_RE.test(message) && uploadIntent === 'study_material_index') || uploadIntent === 'study_material_index';
    const isExplicitDocumentRead = Boolean(message && EXPLICIT_READ.test(message));

    if (documentBase64 && documentMimeType) {
      // Begin Background Ingestion if supported
      if (SUPPORTED_MATERIAL_MIME_TYPES.has(documentMimeType)) {
        const buffer = Buffer.from(documentBase64, 'base64');
        const contentHash = materialContentHash(buffer);
        
        const ingestUploadedMaterial = async () => {
          try {
            const { data: duplicate } = await supabase
              .from('study_materials')
              .select('id, status')
              .eq('user_id', user.id)
              .eq('content_hash', contentHash)
              .neq('status', 'archived')
              .maybeSingle();
            if (!duplicate) {
              const originalFilename = 'chat-upload-' + Date.now();
              const storagePath = `${user.id}/${Date.now()}-${contentHash.slice(0, 12)}-${originalFilename}`;
              const upload = await supabase.storage.from('study-materials').upload(storagePath, buffer, { contentType: documentMimeType, upsert: false });
              if (!upload.error) {
                const { data: material } = await supabase.from('study_materials').insert({
                  user_id: user.id, title: 'Chat Upload', original_filename: originalFilename, mime_type: documentMimeType, storage_path: storagePath, source_type: 'upload', language: 'en', status: 'uploaded', content_hash: contentHash
                }).select('id').single();
                if (material) {
                  await ingestStudyMaterial({
                    materialId: material.id,
                    userId: user.id,
                    buffer,
                    mimeType: documentMimeType,
                  });
                }
              }
            }
          } catch (e) {
            logger.warn('Failed study material ingestion of chat upload', e);
          }
        };

        if (isMaterialIndexing) {
           await ingestUploadedMaterial();
           const answer = "Material uploaded and is being indexed in the background. You can check its status in the Study Materials panel and ask MIND questions from it soon.";
           const stream = new ReadableStream({
             async start(controller) {
               controller.enqueue(encoder.encode(answer));
               try {
                 await finalizeAssistantTurn({
                   assistantText: answer,
                   userMessage: message || '[Document upload]',
                 });
               } catch (e) {}
               controller.close();
             }
           });
           return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        } else {
           await ingestUploadedMaterial();
        }
      }

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
            const documentVisionPrompt = isExplicitDocumentRead && message
              ? message
              : message || 'Read this document and explain the useful study context without inventing details.';
            answer = await routeVisionCall(
              systemPrompt,
              documentBase64,
              documentMimeType,
              documentVisionPrompt
            );
            controller.enqueue(encoder.encode(answer));
          } catch {
            await releaseBudgetReservation(documentBudget.reservationId, 'document_call_failed');
            budgetSettled = true;
            answer = 'I could not read that document reliably. If this is for Test Analysis, upload it with your answer key, student answers, OMR sheet, or result sheet. For explanation, paste the relevant text here.';
            controller.enqueue(encoder.encode(answer));
          }

          try {
            await finalizeAssistantTurn({
              assistantText: answer,
              userMessage: message || '[Document upload]',
              budgetReservationId: budgetSettled ? null : documentBudget.reservationId,
              budgetUsage: budgetSettled ? null : {
                promptTokens: estimateTextTokens(systemPrompt, message || '[Document upload]') + Math.ceil(Buffer.byteLength(documentBase64, 'base64') / 4),
                completionTokens: estimateTextTokens(answer),
                route: '/api/ai/chat',
                promptVersion,
                promptFamily: 'mind_chat',
                promptSource: 'chat_document',
              },
              onBudgetSettled: () => {
                budgetSettled = true;
              },
            });
          } catch (finalizeErr) {
            logger.error('Chat route [document]: finalization failed', finalizeErr);
            controller.close();
            return;
          }

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

          try {
            await finalizeAssistantTurn({
              assistantText: groundingMessage,
              intent,
            });
          } catch (finalizeErr) {
            logger.error('Chat route [grounding]: finalization failed', finalizeErr);
            controller.close();
            return;
          }

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

          try {
            await finalizeAssistantTurn({
              assistantText: responseText,
              intent,
              metadata: deterministicEngineResponse.metadata,
            });
          } catch (finalizeErr) {
            logger.error('Chat route [deterministic-engine]: finalization failed', finalizeErr);
            controller.close();
            return;
          }

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
          if (intent.intent === 'TUTOR_SESSION' || intent.intent === 'PRACTICE') {
            const tutorResult = await ChatTutorService.handleTutorSession(
              supabase,
              user.id,
              intent,
              mindContext,
              systemPrompt,
              recentHistory,
              message || '',
              sessionTurnsCount,
              controller,
              encoder
            );
            fullResponse = tutorResult.fullResponse;
            metadataPayload = tutorResult.metadataPayload;
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
            rag_grounded: Boolean(mindContext?.ragContext?.grounded),
            rag_chunk_count: mindContext?.ragContext?.chunks?.length || 0,
            rag_material_ids: mindContext?.ragContext?.materialIds || [],
            rag_chunk_ids: mindContext?.ragContext?.chunkIds || [],
          };
          metadataPayload = { ...(metadataPayload || {}), contextTrace };

          if (metadataPayload) {
            controller.enqueue(encoder.encode(`\n\n===METADATA===\n${JSON.stringify(metadataPayload)}`));
          }

          await finalizeAssistantTurn({
            assistantText: fullResponse,
            intent,
            metadata: metadataPayload ?? {},
            budgetReservationId: mainBudget?.reservationId ?? null,
            budgetUsage: mainBudget ? {
              promptTokens: estimateMainPromptTokens(systemPrompt, recentHistory, message || ''),
              completionTokens: estimateTextTokens(fullResponse),
              route: '/api/ai/chat',
              promptVersion,
              promptFamily: 'mind_chat',
              promptSource: 'chat_stream',
            } : null,
            onBudgetSettled: () => {
              budgetSettled = true;
            },
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

export async function buildChatFirstEngineResponse(input: {
  userId: string;
  message: string;
  intent: string;
  orchestratorIntent: string;
  mindContext: any;
  supabase: any;
}): Promise<{ text: string; metadata: Record<string, any> } | null> {
  const normalized = input.message.toLowerCase();
  
  let policyIntent: 'direct_generation' | 'memory_query' | 'atlas_query' | 'planning_query' | 'autopsy_query' | 'normal_chat' = 'normal_chat';

  if (/\b(generate mcq|make flashcards|give me flashcard|give flashcard|flashcards for|flashcard for|mcq for|mcqs|explain|formula sheet|make notes|teach me|revise|generate)\b/i.test(normalized)) {
    policyIntent = 'direct_generation';
  } else if (/\b(what is due|show my due|show due|what should i revise from memory|due revision|due cards|memory queue|open memory|my saved revision cards)\b/i.test(normalized) || 
      (input.intent === 'FLASHCARDS' && !/\b(generate|make|create|give me|practice|revise|flashcard for|flashcards for)\b/i.test(normalized))) {
    policyIntent = 'memory_query';
  } else if (/\b(weakest areas|weak areas|weak chapters|where am i weak|what am i weak|what is my mastery|what should i improve|progress|mastery)\b/i.test(normalized) || 
      input.intent === 'ATLAS') {
    policyIntent = 'atlas_query';
  } else if (/\b(today'?s plan|full plan|study plan for tomorrow|plan tomorrow|what should i study tomorrow|targets|schedule|what should i study)\b/i.test(normalized) || 
      (input.orchestratorIntent === 'planning' && !/\b(make|create|give me)\b/i.test(normalized))) {
    policyIntent = 'planning_query';
  } else if (/\b(analy[sz]e my test|check my mock|autopsy|test analysis|paper analysis|analyze mistakes|why did i lose marks|mistake analysis)\b/i.test(normalized) || 
      (input.intent === 'AUTOPSY' && !/\b(make|create|generate)\b/i.test(normalized))) {
    policyIntent = 'autopsy_query';
  }

  // Detect plan edits
  const isPlanEdit = /\b(add|remove|change|shift|lighten|increase|mark|replace)\b/i.test(normalized) && 
                     /\b(plan|target|task|microtask|mcq|mcqs|today|tomorrow)\b/i.test(normalized);

  if (isPlanEdit) {
    try {
      const service = new DailyMicrotaskService(input.supabase);
      const today = new Date().toISOString().split('T')[0];
      const currentTasks = await service.getMicrotasksForDate(input.userId, today);
      
      const editPrompt = `You are a study plan editor. The user wants to edit their plan.
User request: "${input.message}"
Current tasks: ${JSON.stringify(currentTasks.map(t => ({ id: t.id, title: t.title, status: t.status, minutes: t.estimated_minutes })))}

Determine the actions to take. Return ONLY valid JSON:
{
  "actions": [
    {
      "type": "add",
      "title": "<title>",
      "subject": "<optional subject>",
      "estimated_minutes": 15
    },
    {
      "type": "remove",
      "taskId": "<id>"
    },
    {
      "type": "mark_done",
      "taskId": "<id>"
    }
  ],
  "responseMessage": "<Short confirmation message to the user>"
}
If the user wants to clear the plan, use "remove" for all. If they want to lighten, remove some.`;

      const editResult = await generateJSON<any>('flash', 'Return ONLY JSON.', editPrompt);
      if (editResult && editResult.actions) {
        for (const action of editResult.actions) {
          if (action.type === 'add') {
            await service.addMicrotask({
              user_id: input.userId,
              task_date: today,
              title: action.title,
              subject: action.subject || null,
              type: 'custom',
              estimated_minutes: action.estimated_minutes || 15,
              status: 'pending',
              priority: 'medium',
              source: 'mind'
            });
          } else if (action.type === 'remove' && action.taskId) {
            await service.deleteMicrotask(action.taskId, input.userId);
          } else if (action.type === 'mark_done' && action.taskId) {
            await service.updateMicrotaskStatus(action.taskId, input.userId, 'done');
          }
        }
        return {
          text: editResult.responseMessage || 'I have updated your plan for today.',
          metadata: { action: 'plan_edited' }
        };
      }
    } catch (err) {
      // Fallback if JSON generation fails
      console.error('Plan edit failed', err);
    }
  }

  if (policyIntent === 'direct_generation') {
    return null;
  }

  if (policyIntent === 'planning_query') {
    // If the user is just asking for a plan, we return null to let the LLM generate a rich, expanded plan.
    // The LLM will read ctx.commandTasks and ctx.currentSessionCard to do this.
    // But we should ensure the DB has a plan generated for tomorrow/today if missing, just so the state is consistent.
    const targetDate = localDateAfter(/\btomorrow\b/i.test(normalized) ? 1 : 0);
    const planResult = await ensureCommandPlanForDate({
      userId: input.userId,
      date: targetDate,
      client: input.supabase,
    });
    
    // Auto-expand session card into microtasks if none exist for today
    if (targetDate === new Date().toISOString().split('T')[0]) {
      try {
        const service = new DailyMicrotaskService(input.supabase);
        const existingMicrotasks = await service.getMicrotasksForDate(input.userId, targetDate);
        if (existingMicrotasks.length === 0 && planResult.tasks.length > 0) {
          for (const task of planResult.tasks) {
            await service.addMicrotask({
              user_id: input.userId,
              task_date: targetDate,
              title: task.title,
              subject: task.subject || null,
              topic: task.chapter || null,
              type: task.type === 'study' ? 'concept' : task.type,
              estimated_minutes: task.estimated_minutes,
              status: 'pending',
              priority: task.priority,
              source: 'system'
            });
          }
        }
      } catch (err) {
        console.error('Failed to auto-expand plan into microtasks', err);
      }
    }
    
    return null;
  }

  if (policyIntent === 'atlas_query') {
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

  if (policyIntent === 'memory_query') {
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

  if (policyIntent === 'autopsy_query') {
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
