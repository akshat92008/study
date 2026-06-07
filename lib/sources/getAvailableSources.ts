import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export interface AvailableSource {
  id: string;
  title: string;
  status: string;
  chunkCount: number;
  created_at: string;
}

/**
 * Fetches sources that are actually usable for retrieval.
 * Usable means status is 'ready' AND chunkCount > 0.
 */
export async function getAvailableSources(
  supabase: SupabaseClient,
  userId: string
): Promise<AvailableSource[]> {
  try {
    const { data, error } = await supabase
      .from('study_materials')
      .select(`
        id, 
        title, 
        status, 
        created_at,
        study_material_chunks(count)
      `)
      .eq('user_id', userId)
      .in('status', ['ready', 'READY', 'retrieval_available', 'RETRIEVAL_AVAILABLE']);

    if (error) {
      logger.warn('Source relationship count failed; falling back to material list', { userId, error });
      const { data: fallback, error: fallbackError } = await supabase
        .from('study_materials')
        .select('id, title, status, created_at')
        .eq('user_id', userId)
        .in('status', ['ready', 'READY', 'retrieval_available', 'RETRIEVAL_AVAILABLE'])
        .limit(50);

      if (fallbackError) {
        logger.error('Failed to fetch available sources', { userId, error: fallbackError });
        return [];
      }

      return (fallback || []).map(m => ({
        id: m.id,
        title: m.title,
        status: m.status,
        created_at: m.created_at,
        chunkCount: 1
      }));
    }

    return (data || [])
      .map(m => ({
        id: m.id,
        title: m.title,
        status: m.status,
        created_at: m.created_at,
        chunkCount: m.study_material_chunks?.[0]?.count || 0
      }))
      .filter(m => m.chunkCount > 0);
  } catch (err) {
    logger.error('Unexpected error in getAvailableSources', { userId, error: err });
    return [];
  }
}
