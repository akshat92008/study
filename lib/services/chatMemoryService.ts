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
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0 || typeof embedding[0] !== 'number') {
        logger.warn('Skipping memory storage, empty embedding returned', { userId });
        return;
      }

      const supabase = await createClient();
      const { error } = await supabase
        .from('chat_memory')
        .insert({
          user_id: userId,
          content: trimmed,
          embedding: `[${embedding.join(',')}]`,
        });

      if (error) {
        logger.error('Failed to store chat memory embedding', error);
      } else {
        // Eviction strategy: TTL pruning (delete memories older than 30 days)
        // Helps maintain relevance and scale the pgvector index
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        await supabase
          .from('chat_memory')
          .delete()
          .eq('user_id', userId)
          .lt('created_at', thirtyDaysAgo.toISOString())
          .then(({ error }) => {
            if (error) logger.warn('Background memory eviction failed', error);
          });
      }
    } catch (err) {
      logger.error('Error in storeMessageInMemory', err);
    }
  }

  async searchMemory(userId: string, query: string, limit: number = 3): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const supabase = await createClient();
      const matchCount = Math.max(1, Math.min(limit, MAX_MEMORY_RESULTS));

      let vectorMatches: any[] = [];
      const embedding = await getEmbedding(trimmed).catch((err) => {
        logger.warn('Embedding generation failed, falling back to BM25 only', err);
        return null;
      });

      if (embedding && Array.isArray(embedding) && embedding.length > 0 && typeof embedding[0] === 'number') {
        // Semantic Search (pgvector)
        const { data, error } = await supabase.rpc('match_chat_memory', {
          query_embedding: `[${embedding.join(',')}]`,
          match_threshold: 0.70, // lower threshold for hybrid
          match_count: matchCount * 2, // overfetch for RRF
          p_user_id: userId,
        });
        
        if (!error && data) {
          vectorMatches = data;
        } else if (error) {
          logger.warn('match_chat_memory RPC failed, falling back to BM25', { code: error.code });
        }
      }

      // Keyword Search (BM25)
      let textMatches: any[] = [];
      const sanitizedQuery = trimmed.replace(/[^\w\s]/gi, ' ').trim().split(/\s+/).join(' | ');
      
      if (sanitizedQuery) {
        const { data, error } = await supabase
          .from('chat_memory')
          .select('id, content')
          .eq('user_id', userId)
          .textSearch('content', sanitizedQuery)
          .limit(matchCount * 2);
          
        if (!error && data) {
          textMatches = data;
        }
      }

      if (!vectorMatches.length && !textMatches.length) return [];

      // App-level Reciprocal Rank Fusion (RRF)
      const k = 60;
      const scores = new Map<string, { content: string, score: number }>();

      vectorMatches.forEach((match, idx) => {
        const score = 1 / (k + idx + 1);
        scores.set(match.id, { content: match.content, score });
      });

      textMatches.forEach((match, idx) => {
        const score = 1 / (k + idx + 1);
        if (scores.has(match.id)) {
          scores.get(match.id)!.score += score;
        } else {
          scores.set(match.id, { content: match.content, score });
        }
      });

      const sorted = Array.from(scores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, matchCount)
        .map(x => x.content)
        .filter(Boolean);

      return sorted;
    } catch (err: any) {
      logger.error('Error in searchMemory hybrid', { err: err.message, userId });
      return [];
    }
  }
}
