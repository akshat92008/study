'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { processDocumentIntoMemory } from '@/lib/engines/memory-engine';
import pdf from 'pdf-parse';
import { runOCR } from '@/utils/ocr';
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
    if (file) {
      logger.info('Processing file upload for knowledge ingestion', { filename: file.name, type: file.type });
      const buffer = await file.arrayBuffer();
      const bytes = Buffer.from(buffer);

      if (file.type === 'application/pdf') {
        const parsed = await pdf(bytes);
        content = parsed.text;
      } else if (file.type.startsWith('image/')) {
        content = await runOCR(bytes.toString('base64'), file.type);
      } else {
        content = bytes.toString('utf-8');
      }

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
    .from('study_materials')
    .select('id, title, source_type, created_at, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return data || [];
}
