import { createAdminClient } from '@/lib/supabase/admin';
import { chunkExtractedPages } from '@/lib/rag/chunker';
import { getRagConfig } from '@/lib/rag/config';
import { extractMaterialText } from '@/lib/rag/extractors';
import { embedRagText } from '@/lib/rag/embedding';
import { sha256Hex } from '@/lib/rag/hash';
import { logger } from '@/lib/utils/logger';

export type IngestStudyMaterialInput = {
  materialId: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
};

export async function ingestStudyMaterial(input: IngestStudyMaterialInput) {
  const supabase = createAdminClient();
  const config = getRagConfig();

  await supabase
    .from('study_materials')
    .update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', input.materialId)
    .eq('user_id', input.userId);

  try {
    const extracted = await extractMaterialText(input.buffer, input.mimeType);
    if (extracted.ocrRequired && !config.enableOcr) {
      await markMaterialFailed(input.materialId, input.userId, 'This file appears scanned or image-only. OCR is not enabled for private beta.');
      return { status: 'failed' as const, chunks: 0 };
    }

    const chunks = chunkExtractedPages({
      pages: extracted.pages,
      maxChunks: config.maxChunksPerFile,
      chunkSizeChars: config.chunkSizeChars,
      overlapChars: config.chunkOverlapChars,
    });

    if (!chunks.length) {
      await markMaterialFailed(input.materialId, input.userId, 'No searchable text could be extracted from this material.');
      return { status: 'failed' as const, chunks: 0 };
    }

    await supabase
      .from('study_material_chunks')
      .delete()
      .eq('material_id', input.materialId)
      .eq('user_id', input.userId);

    for (const chunk of chunks) {
      const embedding = await embedRagText(chunk.text, {
        userId: input.userId,
        route: 'rag-ingest',
      });

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
          token_estimate: chunk.tokenEstimate,
          content_hash: chunk.contentHash,
          embedding: embedding.length ? `[${embedding.join(',')}]` : null,
          embedding_provider: embedding.length ? 'router' : null,
          embedding_model: embedding.length ? 'router:embedding' : null,
        });

      if (error) throw error;
    }

    const { error: updateError } = await supabase
      .from('study_materials')
      .update({
        status: 'ready',
        page_count: extracted.pageCount,
        char_count: extracted.charCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.materialId)
      .eq('user_id', input.userId);

    if (updateError) throw updateError;
    return { status: 'ready' as const, chunks: chunks.length };
  } catch (error) {
    logger.warn('RAG material ingestion failed', {
      userId: input.userId,
      materialId: input.materialId,
      error: error instanceof Error ? error.message : String(error),
    });
    await markMaterialFailed(
      input.materialId,
      input.userId,
      error instanceof Error ? error.message : 'Material ingestion failed'
    );
    return { status: 'failed' as const, chunks: 0 };
  }
}

async function markMaterialFailed(materialId: string, userId: string, message: string) {
  const supabase = createAdminClient();
  await supabase
    .from('study_materials')
    .update({
      status: 'failed',
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)
    .eq('user_id', userId);
}

export function materialContentHash(buffer: Buffer): string {
  return sha256Hex(buffer);
}
