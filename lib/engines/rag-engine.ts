import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/gemini';

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

  // 2. Simple chunking (by paragraphs/length)
  const chunks = content.split('\n\n').filter(c => c.trim().length > 50);
  
  // 3. Embed and store chunks
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk);
    if (!embedding || embedding.length === 0) continue;
    
    await supabase.from('material_chunks').insert({
      user_id: userId,
      material_id: material.id,
      chunk_text: chunk,
      embedding: embedding as any
    });
  }
  
  return { success: true, chunksProcessed: chunks.length };
}

// Search student's personal database
export async function searchPersonalKnowledge(userId: string, query: string, threshold = 0.5, limit = 3) {
  const supabase = await createClient();
  const queryEmbedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('match_material_chunks', {
    query_embedding: queryEmbedding,
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
