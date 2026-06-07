import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { retrieveRagContext } from '@/lib/rag/retrieval';

export interface RetrievedChunk {
  id: string;
  materialId: string;
  title: string;
  text: string;
  score: number;
  method: 'vector' | 'keyword';
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  warnings: string[];
}

/**
 * Robust retrieval layer for source chunks.
 * Uses vector search with keyword fallback.
 */
export async function retrieveSourceChunks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  options: {
    materialIds?: string[];
    goalId?: string | null;
    limit?: number;
  } = {}
): Promise<RetrievalResult> {
  try {
    const ragContext = await retrieveRagContext({
      userId,
      query,
      topK: options.limit ?? 5,
      materialIds: options.materialIds,
      goalId: options.goalId,
      mode: 'explicit' // Force retrieval mode
    });

    const chunks: RetrievedChunk[] = ragContext.chunks.map(c => ({
      id: c.id,
      materialId: c.materialId,
      title: c.materialTitle,
      text: c.text,
      score: c.score,
      // Infer method from score or just default to vector if grounded
      // In reality, RagContext doesn't explicitly expose method per chunk, 
      // but we can check if vector search failed in logs or just label it based on logic.
      method: c.score > 0.1 ? 'vector' : 'keyword' 
    }));

    return {
      chunks,
      warnings: ragContext.warnings
    };
  } catch (err) {
    logger.error('retrieveSourceChunks failed', { userId, query, error: err });
    return {
      chunks: [],
      warnings: ['Internal error during source retrieval.']
    };
  }
}
