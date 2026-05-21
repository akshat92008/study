'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import { genai, MODELS } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

export async function uploadNotes(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const title = formData.get('title') as string;
  const file = formData.get('file') as File | null;
  let content = formData.get('content') as string;

  if (!title) return { error: 'Title is required' };
  if (!file && !content) return { error: 'Either a file or text content is required' };

  try {
    // Phase 10: Gemini 1.5 Pro Multimodal Extraction Pipeline
    if (file) {
      logger.info('Processing file upload via Gemini Multimodal', { filename: file.name, type: file.type });
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const response = await genai.models.generateContent({
        model: MODELS.pro,
        contents: [
          "Extract all text, equations, and tables from this document accurately. Preserve logical reading order and section headers. Output ONLY the extracted text with proper markdown formatting.",
          {
            inlineData: {
              data: base64,
              mimeType: file.type
            }
          }
        ]
      });

      content = response.text || '';
      if (!content) throw new Error('Failed to extract text from file.');
    }

    // Call the advanced memory engine (semantic chunking)
    const result = await processDocumentIntoMemory(user.id, { title, text: content });
    
    revalidatePath('/knowledge');
    return { success: true, chunks: result.chunks };
  } catch (err: any) {
    logger.error('Upload Notes Failed', err);
    return { error: err.message || 'Failed to process material' };
  }
}

export async function getMaterials() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('materials')
    .select('id, title, source_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return data || [];
}
