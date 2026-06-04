import { budgetedVisionCall } from '@/lib/ai/budgeted';
import { isBudgetExceeded, isBudgetUnavailable, budgetExceededResponse, budgetUnavailableResponse } from '@/lib/ai/cost-guard';
import { createAutopsyJob } from '@/lib/services/autopsy-jobs';
import { materialContentHash } from '@/lib/rag/ingest';
import { getRagConfig, SUPPORTED_MATERIAL_MIME_TYPES } from '@/lib/rag/config';
import { validateMagicBytesArray } from '@/lib/utils/magicBytes';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';
import { apiErrorResponse } from '@/lib/api/errors';

export async function handleVisionUpload({
  userId,
  message,
  imageBase64,
  imageMimeType,
  systemPrompt,
  finalizeAssistantTurn,
  encoder,
}: {
  userId: string;
  message: string;
  imageBase64: string;
  imageMimeType: string;
  systemPrompt: string;
  finalizeAssistantTurn: any;
  encoder: TextEncoder;
}): Promise<Response> {
  let answer = '';
  try {
    answer = await budgetedVisionCall({
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
    answer = 'I could not generate that part right now. Try again in a moment.';
  }

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(answer));
      try {
        await finalizeAssistantTurn({
          assistantText: answer,
          userMessage: message || '[Image upload]',
          budgetReservationId: null,
        });
      } catch (finalizeErr) {
        logger.error('Chat route [image]: finalization failed', finalizeErr);
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
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
  const job = await createAutopsyJob({
    userId,
    fileData,
    testName: 'AI Tutor Chat Upload',
    examType: profilePreview?.exam_type || 'General Study',
    idempotencyKey: `${messageRequestId}:autopsy`,
    source: 'chat_upload',
    goalId: activeGoalId,
    chatSessionId: sessionId,
    client: supabase,
  });

  const responseText = job.status === 'completed'
    ? "I found an existing completed Mistake Review for this upload. Opening Mistake Review now so you can review the processed result."
    : "I've queued this upload for Mistake Review. I will validate the file, classify only evidence-backed mistakes, update this goal's progress and review queue, and use the updated learner state on the next turn.";

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
  if (!SUPPORTED_MATERIAL_MIME_TYPES.has(documentMimeType)) return null;

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
  
  const ingestUploadedMaterial = async (): Promise<boolean> => {
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
        return true;
      }

      const originalFilename = `chat-upload-${contentHash.slice(0, 12)}`;
      const storagePath = `${userId}/${contentHash.slice(0, 12)}-${originalFilename}`;
      const upload = await supabase.storage.from('study-materials').upload(storagePath, buffer, { contentType: documentMimeType, upsert: false });
      if (upload.error) throw upload.error;

      const { data: material, error: materialError } = await supabase.from('study_materials').insert({
        user_id: userId,
        title: 'Chat Upload',
        original_filename: originalFilename,
        mime_type: documentMimeType,
        storage_path: storagePath,
        source_type: 'upload',
        language: 'en',
        status: 'uploaded',
        content_hash: contentHash,
        goal_id: activeGoalId,
        chat_session_id: sessionId,
      }).select('id').single();
      
      if (materialError || !material) throw materialError || new Error('Material insert failed');

      const materialId = material.id;

      const { error: jobError } = await supabase.from('rag_ingestion_jobs').upsert({
        user_id: userId,
        material_id: materialId,
        status: 'queued',
        idempotency_key: `rag_ingestion:${userId}:${materialId}`,
        metadata: { mimeType: documentMimeType },
      }, { onConflict: 'user_id,material_id,idempotency_key' });
      
      if (jobError) throw jobError;

      await EventDispatcher.publish({
        user_id: userId,
        type: 'MATERIAL_UPLOADED',
        data: { materialId },
        metadata: { source: 'chat_upload', goalId: activeGoalId, chatSessionId: sessionId },
        idempotency_key: `material_uploaded:${materialId}`,
      });

      return true;
    } catch (e) {
      logger.warn('Failed study material ingestion of chat upload', e);
      return false;
    }
  };

  if (isMaterialIndexing) {
    const queued = await ingestUploadedMaterial();
    const answer = queued
      ? "Source uploaded and queued for indexing. You can check its status in Sources."
      : "I could not queue that material for indexing. Please try uploading it again.";
      
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
    return null;
  }
}
