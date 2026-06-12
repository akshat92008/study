import { budgetedVisionCall, budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { isBudgetExceeded, isBudgetUnavailable, budgetExceededResponse, budgetUnavailableResponse } from '@/lib/ai/cost-guard';
// import { createAutopsyJob } from '@/lib/services/autopsy-jobs';
import { ingestStudyMaterial, materialContentHash } from '@/lib/rag/ingest';
import { getRagConfig, SUPPORTED_MATERIAL_MIME_TYPES } from '@/lib/rag/config';
import { validateMagicBytesArray } from '@/lib/utils/magicBytes';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { apiErrorResponse } from '@/lib/api/errors';
import { featureFlags } from '@/lib/config/flags';
import { consumeFeatureUsage, enforceFeatureLimit, featureLimitResponse } from '@/lib/usage/enforce-feature-limit';
import { processLearningTransaction } from '@/lib/learning/learning-transaction';
import { z } from 'zod';

const INLINE_INGESTION_MAX_BYTES = 5 * 1024 * 1024;

function streamTextResponse(
  text: string,
  encoder: TextEncoder,
  headers: Record<string, string> = {}
) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    },
  });
}

export function visionUploadsDisabledResponse(encoder: TextEncoder): Response {
  return streamTextResponse(
    'Image and document questions are not enabled for this workspace yet. Enable vision uploads to answer image-based doubts and PDFs in chat.',
    encoder,
    { 'x-provider-routed': 'vision-disabled' }
  );
}

// Zod schema for structured photo-doubt extraction (pass 2)
const PhotoDoubtExtractionSchema = z.object({
  topic: z.string().nullable().optional(),
  subject: z.enum(['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Other']).nullable().optional(),
  conceptsTested: z.array(z.string()).optional(),
  detectedMistake: z.string().nullable().optional(),
  examRelevance: z.string().nullable().optional(),
  nextAction: z.string().nullable().optional(),
  isCorrect: z.boolean().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

type PhotoDoubtExtraction = z.infer<typeof PhotoDoubtExtractionSchema>;

export async function handleVisionUpload({
  userId,
  message,
  imageBase64,
  imageMimeType,
  systemPrompt,
  finalizeAssistantTurn,
  encoder,
  supabase,
  goalId,
  sessionId,
  idempotencyKey,
}: {
  userId: string;
  message: string;
  imageBase64: string;
  imageMimeType: string;
  systemPrompt: string;
  finalizeAssistantTurn: any;
  encoder: TextEncoder;
  supabase?: any;
  goalId?: string | null;
  sessionId?: string | null;
  idempotencyKey?: string;
}): Promise<Response> {
  // ── Pass 1: Vision answer ─────────────────────────────────────────────────
  let rawAnswer = '';
  try {
    rawAnswer = await budgetedVisionCall({
      userId,
      feature: 'chat_vision',
      route: '/api/ai/chat',
      systemPrompt,
      userMessage: message || 'Solve this question completely.',
      imageBase64,
      imageMimeType,
      metadata: { source: 'chat_image' }
    });
  } catch (err) {
    if (isBudgetExceeded(err)) return budgetExceededResponse();
    if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
    rawAnswer = 'I could not generate that part right now. Try again in a moment.';
  }

  // ── Pass 2: Structured extraction (non-blocking, runs concurrently) ───────
  let extraction: PhotoDoubtExtraction | null = null;
  try {
    extraction = await budgetedGenerateJSON<PhotoDoubtExtraction>({
      userId,
      feature: 'chat_vision',
      route: '/api/ai/chat:photo-extract',
      model: 'flash',
      systemPrompt: `You are a NEET/JEE exam analysis engine. Given a student's question image and the AI answer, extract structured metadata.
Return ONLY JSON matching the schema. No prose.`,
      userPrompt: `Student question: "${message || 'Solve this'}"

AI answer:
${rawAnswer.slice(0, 1500)}

Extract:
- topic: the specific topic/concept in the question (e.g. "Photoelectric Effect", "Krebs Cycle")
- subject: Physics | Chemistry | Biology | Mathematics | Other
- conceptsTested: array of up to 4 specific concepts tested in this question
- detectedMistake: if the student seems to have misunderstood something, state it concisely (or null)
- examRelevance: one sentence on how this topic appears in NEET/JEE (or null)
- nextAction: recommended next step for the student (e.g. "Practice 5 more questions on this")
- isCorrect: was the student's question phrasing/attempt correct? (null if unclear)
- confidence: 0-1 confidence in extraction`,
      schema: PhotoDoubtExtractionSchema,
      maxOutputTokens: 300,
    });
  } catch (extractErr) {
    logger.warn('Photo-doubt structured extraction failed (non-blocking)', {
      userId,
      error: extractErr instanceof Error ? extractErr.message : String(extractErr),
    });
  }

  // ── Build structured answer ────────────────────────────────────────────────
  let formattedAnswer = rawAnswer;
  if (extraction?.topic) {
    const lines: string[] = [];
    lines.push(`**${extraction.topic}** ${extraction.subject ? `(${extraction.subject})` : ''}\n`);
    lines.push(rawAnswer.trim());
    if (extraction.examRelevance) {
      lines.push(`\n\n📌 **Exam Relevance:** ${extraction.examRelevance}`);
    }
    if (extraction.nextAction) {
      lines.push(`\n\n➡️ **Next:** ${extraction.nextAction}`);
    }
    formattedAnswer = lines.join('');
  }

  // ── Learning transaction (fire-and-forget) ────────────────────────────────
  let learningDelta = '';
  if (supabase && extraction) {
    try {
      const txResult = await processLearningTransaction({
        supabase,
        userId,
        source: 'photo_doubt',
        idempotencyKey: idempotencyKey ?? `photo_${Date.now()}`,
        sessionId,
        goalId,
        userText: message || null,
        assistantText: rawAnswer,
        imageMetadata: {
          topic: extraction.topic ?? null,
          subject: extraction.subject ?? null,
          conceptsTested: extraction.conceptsTested ?? [],
          detectedMistake: extraction.detectedMistake ?? null,
          isCorrect: extraction.isCorrect ?? null,
          confidence: extraction.confidence ?? 0.65,
        },
      });
      learningDelta = txResult.learningSignalSummary;
    } catch (txErr) {
      logger.warn('Photo-doubt learning transaction failed (non-blocking)', {
        userId,
        error: txErr instanceof Error ? txErr.message : String(txErr),
      });
    }
  }

  const answerWithDelta = learningDelta
    ? `${formattedAnswer}\n\n---\n*${learningDelta}*`
    : formattedAnswer;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(answerWithDelta));
      try {
        await finalizeAssistantTurn({
          assistantText: answerWithDelta,
          userMessage: message || '[Image upload]',
          budgetReservationId: null,
          metadata: {
            source: 'photo_doubt',
            topic: extraction?.topic ?? null,
            subject: extraction?.subject ?? null,
            conceptsTested: extraction?.conceptsTested ?? [],
            detectedMistake: extraction?.detectedMistake ?? null,
            learningDelta,
          },
        });
      } catch (finalizeErr) {
        logger.error('Chat route [image]: finalization failed', finalizeErr);
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-provider-routed': 'vision' } });
}


export async function handleDocumentVisionUpload({
  userId,
  message,
  documentBase64,
  documentMimeType,
  isExplicitDocumentRead,
  systemPrompt,
  finalizeAssistantTurn,
  encoder,
}: {
  userId: string;
  message: string;
  documentBase64: string;
  documentMimeType: string;
  isExplicitDocumentRead: boolean;
  systemPrompt: string;
  finalizeAssistantTurn: any;
  encoder: TextEncoder;
}): Promise<Response> {
  let answer = '';
  try {
    const documentVisionPrompt = isExplicitDocumentRead && message
      ? message
      : message || 'Read this document and explain the useful study context without inventing details.';
    answer = await budgetedVisionCall({
      userId,
      feature: 'chat_document_vision',
      route: '/api/ai/chat',
      systemPrompt,
      userMessage: documentVisionPrompt,
      imageBase64: documentBase64,
      imageMimeType: documentMimeType,
      metadata: { source: 'chat_document' }
    });
  } catch (err) {
    if (isBudgetExceeded(err)) return budgetExceededResponse();
    if (isBudgetUnavailable(err)) return budgetUnavailableResponse();
    answer = 'I could not generate that part right now. Try again in a moment.';
  }

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(answer));
      try {
        await finalizeAssistantTurn({
          assistantText: answer,
          userMessage: message || '[Document upload]',
          budgetReservationId: null,
        });
      } catch (finalizeErr) {
        logger.error('Chat route [document]: finalization failed', finalizeErr);
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-provider-routed': 'document-vision' } });
}

export async function handleAutopsyRedirect({
  userId,
  message,
  fileData,
  profilePreview,
  messageRequestId,
  activeGoalId,
  sessionId,
  supabase,
  finalizeAssistantTurn,
  encoder,
}: {
  userId: string;
  message: string;
  fileData: any;
  profilePreview: any;
  messageRequestId: string;
  activeGoalId?: string;
  sessionId: string;
  supabase: any;
  finalizeAssistantTurn: any;
  encoder: TextEncoder;
}): Promise<Response> {
  const responseText = "To process your mistakes, update your ATLAS concept mastery, and sync revision cards, please upload your test/autopsy files directly through the Autopsy page at /dashboard/autopsy.";

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(responseText));
      try {
        await finalizeAssistantTurn({
          assistantText: responseText,
          userMessage: message || '[Autopsy upload]',
          metadata: { action: 'autopsy_upload_redirect' },
        });
      } catch (finalizeErr) {
        logger.error('Chat route [autopsy-redirect]: finalization failed', finalizeErr);
      }
      controller.close();
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export async function processMaterialIngestion({
  userId,
  documentBase64,
  documentMimeType,
  message,
  isMaterialIndexing,
  activeGoalId,
  sessionId,
  requestId,
  supabase,
  finalizeAssistantTurn,
  encoder,
}: {
  userId: string;
  documentBase64: string;
  documentMimeType: string;
  message: string;
  isMaterialIndexing: boolean;
  activeGoalId?: string;
  sessionId: string;
  requestId: string;
  supabase: any;
  finalizeAssistantTurn: any;
  encoder: TextEncoder;
}): Promise<Response | null> {
  if (!featureFlags.visionUploads()) {
    return visionUploadsDisabledResponse(encoder);
  }

  if (!SUPPORTED_MATERIAL_MIME_TYPES.has(documentMimeType)) return null;

  if (isMaterialIndexing) {
    try {
      await enforceFeatureLimit(userId, 'material_upload');
    } catch (limitError: any) {
      if (limitError?.check) return featureLimitResponse(limitError.check, requestId);
      throw limitError;
    }
  }

  const ragConfig = getRagConfig();
  const buffer = Buffer.from(documentBase64, 'base64');
  
  if (buffer.byteLength > ragConfig.maxFileBytes) {
    return apiErrorResponse('file_too_large', {
      status: 413,
      message: `Study material files are capped at ${Math.round(ragConfig.maxFileBytes / 1024 / 1024)}MB.`,
      requestId,
    });
  }
  
  if (!validateMagicBytesArray(new Uint8Array(buffer.subarray(0, 12)), documentMimeType)) {
    return apiErrorResponse('invalid_file', {
      status: 422,
      message: 'File contents do not match the declared MIME type.',
      requestId,
    });
  }

  const contentHash = materialContentHash(buffer);
  
  const ingestUploadedMaterial = async (): Promise<{ accepted: boolean; status: 'ready' | 'queued' | 'uploaded' | 'failed' | 'duplicate'; chunks: number }> => {
    try {
      const { data: duplicate } = await supabase
        .from('study_materials')
        .select('id, status')
        .eq('user_id', userId)
        .eq('content_hash', contentHash)
        .neq('status', 'archived')
        .maybeSingle();
        
      if (duplicate) {
        if (activeGoalId || sessionId) {
          await supabase
            .from('study_materials')
            .update({
              goal_id: activeGoalId,
              chat_session_id: sessionId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', duplicate.id)
            .eq('user_id', userId);
        }
        return { accepted: true, status: 'duplicate', chunks: 0 };
      }

      const originalFilename = `chat-upload-${contentHash.slice(0, 12)}`;
      const storagePath = `${userId}/${contentHash.slice(0, 12)}-${originalFilename}`;
      const upload = await supabase.storage.from('study-materials').upload(storagePath, buffer, { contentType: documentMimeType, upsert: false });
      if (upload.error) throw upload.error;

      const ragEnabled = featureFlags.ragIngestion();
      const shouldIngestInline =
        ragEnabled &&
        buffer.byteLength <= INLINE_INGESTION_MAX_BYTES;

      const { data: material, error: materialError } = await supabase.from('study_materials').insert({
        user_id: userId,
        title: 'Chat Upload',
        original_filename: originalFilename,
        mime_type: documentMimeType,
        storage_path: storagePath,
        source_type: 'upload',
        language: 'en',
        status: !ragEnabled ? 'uploaded' : shouldIngestInline ? 'processing' : 'queued',
        queued_at: ragEnabled && !shouldIngestInline ? new Date().toISOString() : null,
        content_hash: contentHash,
        goal_id: activeGoalId,
        chat_session_id: sessionId,
      }).select('id').single();
      
      if (materialError || !material) throw materialError || new Error('Material insert failed');

      const materialId = material.id;

      if (ragEnabled && !shouldIngestInline) {
        const { error: jobError } = await supabase.from('rag_ingestion_jobs').upsert({
          user_id: userId,
          material_id: materialId,
          status: 'queued',
          idempotency_key: `rag_ingestion:${userId}:${materialId}`,
          metadata: { mimeType: documentMimeType },
        }, { onConflict: 'user_id,material_id,idempotency_key' });

        if (jobError) throw jobError;
      }

      await EventDispatcher.publish({
        user_id: userId,
        type: 'MATERIAL_UPLOADED',
        data: { materialId },
        metadata: { source: 'chat_upload', goalId: activeGoalId, chatSessionId: sessionId },
        idempotency_key: `material_uploaded:${materialId}`,
      });

      if (shouldIngestInline) {
        const result = await ingestStudyMaterial({
          materialId,
          userId,
          buffer,
          mimeType: documentMimeType,
        });
        return {
          accepted: true,
          status: result.status,
          chunks: result.chunks,
        };
      }

      return { accepted: true, status: ragEnabled ? 'queued' : 'uploaded', chunks: 0 };
    } catch (e) {
      logger.warn('Failed study material ingestion of chat upload', e);
      return { accepted: false, status: 'failed', chunks: 0 };
    }
  };

  if (isMaterialIndexing) {
    const ingestion = await ingestUploadedMaterial();
    if (ingestion.accepted && ingestion.status !== 'duplicate' && ingestion.status !== 'failed') {
      try {
        await consumeFeatureUsage(userId, 'material_upload', 1, {
          idempotencyKey: `material_upload_chat:${userId}:${contentHash.slice(0, 12)}`,
        });
      } catch (usageErr) {
        logger.error('Failed to consume material_upload usage in chat', usageErr);
      }
    }
    const answer = ingestion.accepted
      ? ingestion.status === 'ready'
          ? `Source uploaded and indexed. I extracted ${ingestion.chunks} searchable chunk${ingestion.chunks === 1 ? '' : 's'} and can use it now.`
          : ingestion.status === 'uploaded'
            ? "Source uploaded. Source indexing is disabled right now, so I cannot use it for retrieval until RAG ingestion is enabled."
          : ingestion.status === 'duplicate'
            ? "Source already exists. I linked it to this chat so I can use it now."
          : "Source uploaded and queued for indexing. You can check its status in Sources."
      : "I could not queue that material for indexing. Please try uploading it again.";
      
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(answer));
        try {
          await finalizeAssistantTurn({
            assistantText: answer,
            userMessage: message || '[Document upload]',
          });
        } catch {}
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } else {
    return null;
  }
}
