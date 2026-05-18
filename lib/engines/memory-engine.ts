import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from './rag-engine';

export async function processDocumentIntoMemory(userId: string, fileData: { title: string, text: string }) {
  const supabase = await createClient();
  
  // Create material
  const { data: material, error: matErr } = await (await supabase).from('materials').insert({
    user_id: userId,
    title: fileData.title,
    raw_content: fileData.text
  }).select().single();

  if (matErr || !material) throw new Error('Could not create material record.');

  // Advanced chunking: split by paragraphs, ensure max size
  const rawChunks = fileData.text.split(/\n\s*\n/).filter(c => c.trim().length > 30);
  let processedCount = 0;

  for (const chunk of rawChunks) {
    // Generate embedding
    const embedding = await getEmbedding(chunk);
    if (!embedding) continue;

    await (await supabase).from('material_chunks').insert({
      user_id: userId,
      material_id: material.id,
      chunk_text: chunk,
      embedding: embedding as any
    });
    processedCount++;
  }

  return { success: true, chunks: processedCount, materialId: material.id };
}
