'use server';

import { createClient } from '@/lib/supabase/server';
import { ingestMaterial } from '@/lib/engines/rag-engine';
import { revalidatePath } from 'next/cache';

export async function uploadNotes(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  if (!title || !content) return { error: 'Title and content are required' };

  try {
    // Calls the RAG engine you built!
    const result = await ingestMaterial(user.id, title, content);
    revalidatePath('/knowledge');
    return { success: true, chunks: result.chunksProcessed };
  } catch (err: any) {
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
