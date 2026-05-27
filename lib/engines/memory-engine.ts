import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/gemini';

function buildSemanticChunks(text: string, chunkSize = 800, overlap = 150): string[] {
  const chunks: string[] = [];

  // Split on natural boundaries: headings, double newlines, then sentences
  const sections = text.split(/\n{2,}|\r\n{2,}/);
  let currentChunk = '';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // Overlap: carry the last 'overlap' characters into the next chunk
        // so that concepts spanning chunk boundaries are retrievable
        currentChunk = currentChunk.slice(-overlap) + '\n\n' + trimmed;
      } else {
        // Section itself is larger than chunkSize — split by sentences
        const sentences = trimmed.match(/[^.!?]+[.!?]+/g) || [trimmed];
        let sentenceChunk = '';
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length <= chunkSize) {
            sentenceChunk += sentence;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk.trim());
            sentenceChunk = currentChunk.slice(-overlap) + sentence;
          }
        }
        if (sentenceChunk) currentChunk = sentenceChunk;
      }
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  // Filter out chunks that are too short to be meaningful
  return chunks.filter(c => c.length > 100);
}

export async function processDocumentIntoMemory(userId: string, fileData: { title: string, text: string, storage_path?: string | null, file_size_bytes?: number | null, mime_type?: string | null, original_filename?: string | null }) {
  const supabase = await createClient();
  
  // Create material
  const { data: material, error: matErr } = await supabase.from('materials').insert({
    user_id: userId,
    title: fileData.title,
    raw_content: fileData.text,
    storage_path: fileData.storage_path ?? null,
    file_size_bytes: fileData.file_size_bytes ?? null,
    mime_type: fileData.mime_type ?? null,
    original_filename: fileData.original_filename ?? null
  }).select().single();

  if (matErr || !material) throw new Error('Could not create material record.');

  // Advanced semantic chunking
  const rawChunks = buildSemanticChunks(fileData.text, 800, 150);
  let processedCount = 0;

  for (const chunk of rawChunks) {
    // Generate dense vector embedding
    const embedding = await getEmbedding(chunk);
    if (!embedding || embedding.length === 0) continue;

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
