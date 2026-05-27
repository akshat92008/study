import { getEmbedding } from '@/lib/ai/gemini';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const MAX_MEMORY_RESULTS = 8;

export class ChatMemoryService {
  async storeMessageInMemory(userId: string, content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      const embedding = await getEmbedding(trimmed);
      if (!embedding || embedding.length === 0) {
        logger.warn('Skipping memory storage, empty embedding returned', { userId });
        return;
      }

      const supabase = await createClient();
      const { error } = await supabase
        .from('chat_memory_embeddings')
        .insert({
          user_id: userId,
          content: trimmed,
          embedding: `[${embedding.join(',')}]`,
        });

      if (error) {
        logger.error('Failed to store chat memory embedding', error);
      }
    } catch (err) {
      logger.error('Error in storeMessageInMemory', err);
    }
  }

  async searchMemory(userId: string, query: string, limit: number = 3): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const embedding = await getEmbedding(trimmed);
      if (!embedding || embedding.length === 0) return [];

      const supabase = await createClient();
      const matchCount = Math.max(1, Math.min(limit, MAX_MEMORY_RESULTS));
      const { data, error } = await supabase.rpc('match_chat_memory', {
        query_embedding: `[${embedding.join(',')}]`,
        match_threshold: 0.75,
        match_count: matchCount,
        p_user_id: userId,
      });

      if (error) {
        if (error.code === 'PGRST202') {
          throw new Error('CRITICAL: match_chat_memory RPC is missing. Run 024_match_chat_memory.sql.');
        }
        logger.error('Failed to search chat memory', { error });
        return [];
      }

      return (data || []).slice(0, matchCount).map((row: any) => row.content).filter(Boolean);
    } catch (err) {
      logger.error('Error in searchMemory', err);
      return [];
    }
  }
}
