import { BaseService } from './base.service';
import { getEmbedding } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

export class ChatMemoryService extends BaseService {
  /**
   * Embeds and stores an older chat message into pgvector memory.
   */
  async storeMessageInMemory(userId: string, content: string): Promise<void> {
    try {
      const embedding = await getEmbedding(content);
      if (!embedding || embedding.length === 0) {
        logger.warn('Skipping memory storage, empty embedding returned', { userId });
        return;
      }

      const supabase = await this.getClient();
      // Use pgvector's vector string representation: '[1.0, 2.0, ...]'
      const embeddingString = `[${embedding.join(',')}]`;

      const { error } = await supabase
        .from('chat_memory_embeddings')
        .insert({
          user_id: userId,
          content,
          embedding: embeddingString
        });

      if (error) {
        logger.error('Failed to store chat memory embedding', error);
      }
    } catch (err) {
      logger.error('Error in storeMessageInMemory', err);
    }
  }

  /**
   * Semantically searches the user's older chats for relevant context based on their current query.
   */
  async searchMemory(userId: string, query: string, limit: number = 3): Promise<string[]> {
    try {
      const embedding = await getEmbedding(query);
      if (!embedding || embedding.length === 0) return [];

      const supabase = await this.getClient();
      const embeddingString = `[${embedding.join(',')}]`;

      // We need a custom RPC to perform the pgvector similarity search since Supabase REST
      // doesn't natively expose the `<->` operator without it.
      // Assuming RPC `match_chat_memory` is created:
      const { data, error } = await supabase.rpc('match_chat_memory', {
        query_embedding: embeddingString,
        match_threshold: 0.75,
        match_count: limit,
        p_user_id: userId
      });

      if (error) {
        if (error.code === 'PGRST202') {
          // RPC not found - log warning and return empty memory instead of crashing
          logger.warn('match_chat_memory RPC not found, semantic memory fallback triggered.');
          return [];
        }
        logger.error('Failed to search chat memory', error);
        return [];
      }

      return (data || []).map((row: any) => row.content);
    } catch (err) {
      logger.error('Error in searchMemory', err);
      return [];
    }
  }
}
