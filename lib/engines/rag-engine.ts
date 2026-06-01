import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/provider-client';
import { SupabaseClient } from '@supabase/supabase-js';
import { retrieveRagContext } from '@/lib/rag/retrieval';

export function chunkText(text: string, chunkSize = 400, overlapSize = 80): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.length > 50) chunks.push(chunk); // filter tiny trailing chunks
    i += chunkSize - overlapSize; // overlap for context continuity
  }

  return chunks;
}

// Ingest text, chunk it, embed it, and store it
export async function ingestMaterial(userId: string, title: string, content: string) {
  const supabase = await createClient();
  
  // 1. Save parent material
  const { data: material, error } = await supabase.from('materials').insert({
    user_id: userId,
    title,
    raw_content: content
  }).select().single();
  
  if (error || !material) throw new Error('Failed to save material');

  // 2. Overlapping chunking
  const chunks = chunkText(content);
  
  // 3. Embed and store chunks
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk, {
      userId,
      route: 'rag-ingest',
    });
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0 || typeof embedding[0] !== "number") continue;
    
    await supabase.from('material_chunks').insert({
      user_id: userId,
      material_id: material.id,
      chunk_text: chunk,
      embedding: `[${embedding.join(',')}]`
    });
  }
  
  return { success: true, chunksProcessed: chunks.length };
}

// Search student's personal database
export async function searchPersonalKnowledge(userId: string, query: string, threshold = 0.5, limit = 3) {
  const supabase = await createClient();
  const queryEmbedding = await getEmbedding(query, {
    userId,
    route: 'rag-search',
  });
  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0 || typeof queryEmbedding[0] !== 'number') return [];

  const { data, error } = await supabase.rpc('match_material_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: threshold,
    match_count: limit,
    p_user_id: userId
  });

  if (error) {
    console.error('Vector search error:', error);
    return [];
  }
  return data || [];
}

export class RAGEngine {
  constructor(private supabase: SupabaseClient) {}

  async retrieve(input: {
    userId: string;
    query: string;
    materialIds?: string[];
    subject?: string | null;
    chapter?: string | null;
  }) {
    return retrieveRagContext({
      supabase: this.supabase,
      userId: input.userId,
      query: input.query,
      materialIds: input.materialIds,
      subject: input.subject,
      chapter: input.chapter,
    });
  }

  async search({ userId, query, limit = 4 }: { userId: string, query: string, limit?: number, minSimilarity?: number }) {
    const context = await this.retrieve({ userId, query });
    return context.chunks.slice(0, limit).map((chunk) => ({
      id: chunk.id,
      materialId: chunk.materialId,
      content: chunk.text,
      similarity: chunk.score,
      sourceTitle: chunk.materialTitle,
      citation: chunk.citation,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      heading: chunk.heading,
    }));
  }
}
