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
      logger.warn('Source relationship count failed; falling back to explicit chunk counts', { userId, error });
      
      const { data: materials, error: mError } = await supabase
        .from('study_materials')
        .select('id, title, status, created_at')
        .eq('user_id', userId)
        .in('status', ['ready', 'READY', 'retrieval_available', 'RETRIEVAL_AVAILABLE']);

      if (mError || !materials) return [];

      const { data: chunkCounts, error: cError } = await supabase
        .from('study_material_chunks')
        .select('material_id')
        .eq('user_id', userId)
        .in('material_id', materials.map(m => m.id));

      if (cError) return [];

      const counts = (chunkCounts || []).reduce((acc: Record<string, number>, c: any) => {
        acc[c.material_id] = (acc[c.material_id] || 0) + 1;
        return acc;
      }, {});

      return materials
        .map(m => ({
          id: m.id,
          title: m.title,
          status: m.status,
          created_at: m.created_at,
          chunkCount: counts[m.id] || 0
        }))
        .filter(m => m.chunkCount > 0);
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
