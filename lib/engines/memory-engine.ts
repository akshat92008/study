import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from './rag-engine';

/**
 * Recursively splits text into overlapping chunks, respecting paragraphs and sentences.
 */
function recursiveChunkText(text: string, maxTokens = 1000, overlap = 200): string[] {
  // Rough approximation: 1 token ~ 4 characters
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;
  const chunks: string[] = [];
  
  if (text.length <= maxChars) return [text];

  const separators = ['\n\n', '\n', '. ', '? ', '! ', ' '];
  
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    
    // If we're at the end of the text, just grab the rest
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Try to find a logical break point near the end limit
    let bestBreak = -1;
    for (const sep of separators) {
      const lastIndex = text.lastIndexOf(sep, end);
      // Ensure the break isn't too far back (e.g., losing more than 30% of the chunk)
      if (lastIndex !== -1 && lastIndex > start + (maxChars * 0.7)) {
        bestBreak = lastIndex + sep.length;
        break;
      }
    }

    // Fallback if no logical separator found
    if (bestBreak === -1) bestBreak = end;

    const chunk = text.slice(start, bestBreak).trim();
    if (chunk.length > 30) chunks.push(chunk); // Ignore tiny fragments
    
    // Retreat slightly to create overlap
    start = bestBreak - overlapChars;
    if (start < 0) start = 0; // Boundary check
    
    // Ensure we're moving forward even if overlap is large
    if (start >= bestBreak) start = bestBreak; 
  }

  return chunks;
}

export async function processDocumentIntoMemory(userId: string, fileData: { title: string, text: string }) {
  const supabase = await createClient();
  
  // Create material
  const { data: material, error: matErr } = await supabase.from('materials').insert({
    user_id: userId,
    title: fileData.title,
    raw_content: fileData.text
  }).select().single();

  if (matErr || !material) throw new Error('Could not create material record.');

  // Advanced learning-aware chunking (1000 tokens, 200 token overlap)
  const rawChunks = recursiveChunkText(fileData.text, 1000, 200);
  let processedCount = 0;

  for (const chunk of rawChunks) {
    // Generate dense vector embedding
    const embedding = await getEmbedding(chunk);
    if (!embedding) continue;

    // We do NOT need to generate fts_vector here, 
    // it is GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED at DB level.
    await supabase.from('material_chunks').insert({
      user_id: userId,
      material_id: material.id,
      chunk_text: chunk,
      embedding: embedding as any
    });
    processedCount++;
  }

  return { success: true, chunks: processedCount, materialId: material.id };
}
