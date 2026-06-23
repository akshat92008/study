import { createAdminClient } from '@/lib/supabase/admin';
import { chunkExtractedPages } from '@/lib/rag/chunker';
import { getRagConfig } from '@/lib/rag/config';
import { extractMaterialText } from '@/lib/rag/extractors';
import { embedRagText } from '@/lib/rag/embedding';
import { sha256Hex } from '@/lib/rag/hash';
import { logger } from '@/lib/utils/logger';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { recordAgentAction } from '@/lib/agents/agent-runtime';
import { budgetedVisionCall } from '@/lib/ai/budgeted';
import { analyzeMaterialText } from '@/lib/materials/study-room-analysis';

export type IngestStudyMaterialInput = {
  materialId: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
};

export async function ingestStudyMaterial(input: IngestStudyMaterialInput) {
  const supabase = createAdminClient();
  const config = getRagConfig();
  const jobIdempotencyKey = `rag_ingestion:${input.userId}:${input.materialId}`;

  const job = await ensureRagIngestionJob(input, jobIdempotencyKey).catch((error) => {
    logger.warn('RAG ingestion job creation failed; continuing material ingestion', {
      userId: input.userId,
      materialId: input.materialId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  await supabase
    .from('study_materials')
    .update({ 
      status: 'processing', 
      retryable: false, 
      error_message: null, 
      last_error: null,
      last_error_code: null,
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString() 
    })
    .eq('id', input.materialId)
    .eq('user_id', input.userId);

  logger.info('material_processing_started', {
    userId: input.userId,
    materialId: input.materialId,
    jobId: job?.id ?? null,
  });

  try {
    await updateRagJob(job?.id, input.userId, 'extracting');
    const extracted = await extractMaterialText(input.buffer, input.mimeType);
    if (extracted.ocrRequired && !config.enableOcr) {
      if (!config.ocrFallbackToVision) {
        await failRagJob(job?.id, input.userId, 'ocr_required', 'This file appears scanned or image-only. OCR is not enabled. Enable RAG_OCR_FALLBACK_VISION or RAG_ENABLE_OCR to process scanned PDFs.');
        await markMaterialFailed(input.materialId, input.userId, 'This file appears scanned or image-only. Enable OCR to process this file.', 'ocr_required', false);
        return { status: 'failed' as const, chunks: 0 };
      }

      // Vision fallback: send the PDF buffer to vision AI and extract text
      logger.info('RAG: OCR required, attempting vision-based text extraction', {
        userId: input.userId,
        materialId: input.materialId,
        mimeType: input.mimeType,
      });
      try {
        const imageBase64 = input.buffer.toString('base64');
        const visionText = await budgetedVisionCall({
          userId: input.userId,
          feature: 'rag_ocr_fallback',
          route: 'rag-ingest-vision',
          systemPrompt: 'You are a document extraction engine. Extract all text from this image or scanned document exactly as it appears. Preserve headings, bullet points, formulas, and structure. Output only the extracted text with no commentary.',
          userMessage: 'Extract all text from this scanned document for study material indexing.',
          imageBase64,
          imageMimeType: input.mimeType,
          metadata: { source: 'rag_ocr_fallback', materialId: input.materialId },
        });

        if (!visionText || visionText.trim().length < 50) {
          await failRagJob(job?.id, input.userId, 'ocr_vision_empty', 'Vision extraction returned no usable text from this file.');
          await markMaterialFailed(input.materialId, input.userId, 'Could not extract text from this scanned file. Try uploading a clearer scan or a text-based PDF.', 'ocr_vision_empty', false);
          return { status: 'failed' as const, chunks: 0 };
        }

        // Replace extracted pages with vision output and continue normal pipeline
        extracted.pages = [{ pageNumber: 1, text: visionText.trim() }];
        extracted.charCount = visionText.length;
        extracted.ocrRequired = false;
        logger.info('RAG: Vision OCR fallback succeeded', {
          userId: input.userId,
          materialId: input.materialId,
          extractedChars: visionText.length,
        });
      } catch (visionErr) {
        logger.warn('RAG: Vision OCR fallback failed', {
          userId: input.userId,
          materialId: input.materialId,
          error: visionErr instanceof Error ? visionErr.message : String(visionErr),
        });
        await failRagJob(job?.id, input.userId, 'ocr_vision_failed', 'Vision extraction failed for this scanned file. Try a clearer scan or a text-based PDF.');
        await markMaterialFailed(input.materialId, input.userId, 'Could not extract text from this scanned file via vision. Try uploading a clearer scan.', 'ocr_vision_failed', true);
        return { status: 'failed' as const, chunks: 0 };
      }
    }

    await updateRagJob(job?.id, input.userId, 'chunking');
    const materialAnalysis = analyzeMaterialText(extracted.pages.map(page => page.text).join('\n\n'));
    const chunks = chunkExtractedPages({
      pages: extracted.pages,
      maxChunks: config.maxChunksPerFile,
      chunkSizeChars: config.chunkSizeChars,
      overlapChars: config.chunkOverlapChars,
    });

    if (chunks.length === 0) {
      await failRagJob(job?.id, input.userId, 'chunking_empty', 'No text chunks could be extracted from this material.');
      await markMaterialFailed(input.materialId, input.userId, 'Could not extract any readable text from this file.', 'chunking_empty', false);
      return { status: 'failed' as const, chunks: 0 };
    }

    await supabase
      .from('study_material_chunks')
      .delete()
      .eq('material_id', input.materialId)
      .eq('user_id', input.userId);

    await updateRagJob(job?.id, input.userId, 'embedding', { chunkCount: chunks.length });
    
    const BATCH_SIZE = 5;
    let embeddingCount = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await embedRagText(chunk.text, {
            userId: input.userId,
            route: 'rag-ingest',
          });
          return { chunk, embedding };
        })
      );

      for (const { chunk, embedding } of batchResults) {
        if (embedding.length > 0) embeddingCount += 1;
        const { error } = await supabase
          .from('study_material_chunks')
          .insert({
            material_id: input.materialId,
            user_id: input.userId,
            chunk_index: chunk.chunkIndex,
            page_start: chunk.pageStart,
            page_end: chunk.pageEnd,
            heading: chunk.heading,
            text: chunk.text,
            content: chunk.text,
            token_estimate: chunk.tokenEstimate,
            content_hash: chunk.contentHash,
            embedding: embedding.length ? `[${embedding.join(',')}]` : null,
            embedding_provider: embedding.length ? 'router' : null,
            embedding_model: embedding.length ? 'router:embedding' : null,
          });

        if (error) throw error;
      }
    }

    const { error: updateError } = await supabase
      .from('study_materials')
      .update({
        status: 'ready',
        retryable: false,
        page_count: extracted.pageCount,
        char_count: extracted.charCount,
        chunk_count: chunks.length,
        embedding_count: embeddingCount,
        material_analysis: materialAnalysis,
        source_type: materialAnalysis.sourceType === 'unknown' ? undefined : materialAnalysis.sourceType,
        processing_finished_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString(),
        error_message: null,
        last_error: null,
        last_error_code: null,
        next_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.materialId)
      .eq('user_id', input.userId);

    if (updateError) throw updateError;
    logger.info('material_processing_succeeded', {
      userId: input.userId,
      materialId: input.materialId,
      chunkCount: chunks.length,
      embeddingCount,
    });
    await completeRagJob(job?.id, input.userId, { chunks: chunks.length, pageCount: extracted.pageCount });
    
    await recordAgentAction({
      userId: input.userId,
      agentName: 'rag',
      actionType: 'material_ingested',
      targetType: 'study_material',
      targetId: input.materialId,
      status: 'applied',
      confidence: 1.0,
      evidence: { chunks: chunks.length, pageCount: extracted.pageCount },
      idempotencyKey: `rag_ingestion_action:${input.userId}:${input.materialId}`,
    }, { client: supabase }).catch(err => logger.warn('Failed to record RAG ingestion action', err));

    await EventDispatcher.publish({
      user_id: input.userId,
      type: 'MATERIAL_INGESTED',
      data: {
        materialId: input.materialId,
        jobId: job?.id ?? null,
        chunkCount: chunks.length,
        pageCount: extracted.pageCount,
      },
      metadata: { source: 'rag_agent' },
      idempotency_key: `material_ingested:${input.materialId}:${chunks.length}`,
    }).catch((error) => logger.warn('Failed to publish MATERIAL_INGESTED', {
      userId: input.userId,
      materialId: input.materialId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return { status: 'ready' as const, chunks: chunks.length };
  } catch (error) {
    logger.warn('RAG material ingestion failed', {
      userId: input.userId,
      materialId: input.materialId,
      error: error instanceof Error ? error.message : String(error),
    });
    await failRagJob(
      job?.id,
      input.userId,
      'ingestion_failed',
      error instanceof Error ? error.message : 'Material ingestion failed'
    );
    await markMaterialFailed(
      input.materialId,
      input.userId,
      error instanceof Error ? error.message : 'Material ingestion failed',
      'ingestion_failed',
      true
    );
    return { status: 'failed' as const, chunks: 0 };
  }
}

async function markMaterialFailed(
  materialId: string,
  userId: string,
  message: string,
  errorCode: string = 'ingestion_failed',
  retryable = true
) {
  const supabase = createAdminClient();
  const nextRetryAt = retryable
    ? new Date(Date.now() + 5 * 60_000).toISOString()
    : null;

  await supabase
    .from('study_materials')
    .update({
      status: retryable ? 'retryable_failed' : 'failed',
      retryable,
      error_message: message.slice(0, 500),
      last_error: message.slice(0, 500),
      last_error_code: errorCode,
      next_retry_at: nextRetryAt,
      processing_finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)
    .eq('user_id', userId);

  logger.warn('material_processing_failed', {
    userId,
    materialId,
    errorCode,
    retryable,
    nextRetryAt,
    error: message,
  });
}

export function materialContentHash(buffer: Buffer): string {
  return sha256Hex(buffer);
}

async function ensureRagIngestionJob(input: IngestStudyMaterialInput, idempotencyKey: string) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from('rag_ingestion_jobs')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('material_id', input.materialId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from('rag_ingestion_jobs')
    .insert({
      user_id: input.userId,
      material_id: input.materialId,
      status: 'queued',
      idempotency_key: idempotencyKey,
      metadata: { mimeType: input.mimeType },
    })
    .select('id, status')
    .single();

  if (error) throw error;
  return data;
}

async function updateRagJob(
  jobId: string | undefined,
  userId: string,
  status: 'extracting' | 'chunking' | 'embedding',
  metadata: Record<string, unknown> = {}
) {
  if (!jobId) return;
  const supabase = createAdminClient();
  const updatePayload: Record<string, unknown> = {
    status,
    metadata,
    updated_at: new Date().toISOString(),
  };
  if (status === 'extracting') {
    updatePayload.started_at = new Date().toISOString();
  }
  await supabase
    .from('rag_ingestion_jobs')
    .update(updatePayload)
    .eq('id', jobId)
    .eq('user_id', userId);
}

async function completeRagJob(jobId: string | undefined, userId: string, metadata: Record<string, unknown>) {
  if (!jobId) return;
  const supabase = createAdminClient();
  await supabase
    .from('rag_ingestion_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('user_id', userId);
}

async function failRagJob(jobId: string | undefined, userId: string, errorCode: string, message: string) {
  if (!jobId) return;
  const supabase = createAdminClient();
  await supabase
    .from('rag_ingestion_jobs')
    .update({
      status: 'failed',
      error: message.slice(0, 500),
      error_code: errorCode,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('user_id', userId);
}
