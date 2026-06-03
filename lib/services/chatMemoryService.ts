import { getEmbedding } from '@/lib/ai/provider-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { routeJSONGeneration } from '@/lib/ai/router';
import {
  isBudgetExceeded,
  isBudgetUnavailable,
  reserveBudgetForModelCall,
} from '@/lib/ai/cost-guard';

const MAX_MEMORY_RESULTS = 8;
const EMOTIONAL_MEMORY_PATTERN = /scared|failed|quit|hate|tired|stuck|help|overwhelmed|give up/i;

interface ChatMemoryMatch {
  id: string;
  content: string;
}

export type ChatMemorySourceType =
  | 'global_chat'
  | 'mentor_chat'
  | 'tutor_chat'
  | 'session_chat'
  | 'autopsy'
  | 'memory_review';

export interface StoreMemoryOptions {
  sourceType?: ChatMemorySourceType;
  sourceId?: string | null;
  sessionId?: string | null;
  role?: 'user' | 'assistant' | 'system';
  createdAt?: string;
}

export interface StoreConversationTurnInput {
  sourceType: ChatMemorySourceType;
  sessionId?: string | null;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  userMessage: string;
  assistantMessage?: string;
}

const LOW_MEMORY_SCORES = {
  importance: 0,
  novelty: 0,
  emotional_salience: 0,
  learning_relevance: 0,
  repetition_signal: 0,
};

function fallbackMemoryScores(content: string) {
  if (EMOTIONAL_MEMORY_PATTERN.test(content)) {
    return {
      ...LOW_MEMORY_SCORES,
      importance: 7,
      emotional_salience: 8,
    };
  }
  return LOW_MEMORY_SCORES;
}

export class ChatMemoryService {
  async storeConversationTurnInMemory(userId: string, input: StoreConversationTurnInput): Promise<void> {
    await this.storeMessageInMemory(userId, input.userMessage, {
      sourceType: input.sourceType,
      sourceId: input.userMessageId,
      sessionId: input.sessionId,
      role: 'user',
    });

    if (input.assistantMessage) {
      await this.storeMessageInMemory(userId, input.assistantMessage, {
        sourceType: input.sourceType,
        sourceId: input.assistantMessageId,
        sessionId: input.sessionId,
        role: 'assistant',
      });
    }
  }

  async storeMessageInMemory(userId: string, content: string, options: StoreMemoryOptions = {}): Promise<void> {
    const trimmed = content.trim();
    if (trimmed.length < 15 && !EMOTIONAL_MEMORY_PATTERN.test(trimmed)) return; // Immediate drop for short conversational noise, unless emotional

    try {
      const supabase = createAdminClient();
      if (options.sourceId) {
        const { data: existing } = await supabase
          .from('chat_memory')
          .select('id')
          .eq('user_id', userId)
          .eq('source_type', options.sourceType ?? 'global_chat')
          .eq('source_id', options.sourceId)
          .eq('role', options.role ?? 'user')
          .maybeSingle();

        if (existing?.id) {
          logger.info('Skipping duplicate chat memory write', {
            userId,
            sourceType: options.sourceType,
            sourceId: options.sourceId,
            role: options.role,
          });
          return;
        }
      }

      // 1. Hybrid Scoring
      const checkPrompt = `Evaluate this user message for semantic memory storage.
Message: "${trimmed}"
Rate the following from 0.0 to 10.0:
1. importance: Overall value for long-term retention.
2. novelty: Is this new information about the user?
3. emotional_salience: Does it show strong motivation, frustration, or anxiety?
4. learning_relevance: Does it contain specific facts about their curriculum, goals, or weak points?
5. repetition_signal: Is the user repeating something they mentioned before?

Return ONLY valid JSON in this exact format:
{
  "importance": 0.0,
  "novelty": 0.0,
  "emotional_salience": 0.0,
  "learning_relevance": 0.0,
  "repetition_signal": 0.0
}`;

      type HybridScores = { importance: number; novelty: number; emotional_salience: number; learning_relevance: number; repetition_signal: number };
      const evalResult = await (async (): Promise<HybridScores> => {
        try {
          const reservation = await reserveBudgetForModelCall(
            userId,
            'memory-scoring',
            'router:json',
            Math.max(1, Math.ceil(checkPrompt.length / 4)),
            200
          );

          return await routeJSONGeneration<HybridScores>(
            'You are an expert semantic memory analyzer. Only provide high scores for highly specific and valuable insights. Generic chatter scores 0.',
            checkPrompt,
            0.1,
            undefined,
            reservation.reservationId
          );
        } catch (err) {
          if (isBudgetExceeded(err) || isBudgetUnavailable(err)) {
            logger.warn('Skipping memory scoring because AI budget is unavailable', { userId });
          }
          return fallbackMemoryScores(trimmed);
        }
      })();

      // Accept if importance is high, or if it's highly emotionally salient or relevant to learning
      if (evalResult.importance < 6 && evalResult.learning_relevance < 7 && evalResult.emotional_salience < 7) {
        logger.info('Skipping memory storage, low hybrid scores', { scores: evalResult, userId });
        return;
      }

      const embedding = await getEmbedding(trimmed, {
        userId,
        route: 'chat-memory-store',
      });
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0 || typeof embedding[0] !== 'number') {
        logger.warn('Skipping memory storage, empty embedding returned', { userId });
        return;
      }

      const { error } = await supabase
        .from('chat_memory')
        .insert({
          user_id: userId,
          session_id: options.sessionId ?? null,
          content: trimmed,
          embedding: `[${embedding.join(',')}]`,
          source_type: options.sourceType ?? 'global_chat',
          source_id: options.sourceId ?? null,
          role: options.role ?? 'user',
          importance_score: evalResult.importance,
          novelty_score: evalResult.novelty,
          emotional_score: evalResult.emotional_salience,
          learning_score: evalResult.learning_relevance,
          repetition_score: evalResult.repetition_signal
        });

      if (error) {
        logger.error('Failed to store chat memory embedding', error);
      } else {
        logger.info('Stored durable chat memory', { userId });
      }
    } catch (err) {
      logger.error('Error in storeMessageInMemory', err);
    }
  }

  async searchMemory(userId: string, query: string, limit: number = 3): Promise<string[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const supabase = createAdminClient();
      const matchCount = Math.max(1, Math.min(limit, MAX_MEMORY_RESULTS));

      // Run semantic and keyword searches in parallel
      const sanitizedQuery = trimmed.replace(/[^\w\s]/gi, ' ').trim().split(/\s+/).join(' | ');

      const [vectorResult, textResult] = await Promise.all([
        (async () => {
          const embedding = await getEmbedding(trimmed, {
            userId,
            route: 'chat-memory-search',
          }).catch((err) => {
            logger.warn('Embedding generation failed, falling back to BM25 only', err);
            return null;
          });

          if (embedding && Array.isArray(embedding) && embedding.length > 0 && typeof embedding[0] === 'number') {
            const { data, error } = await supabase.rpc('match_chat_memory', {
              query_embedding: `[${embedding.join(',')}]`,
              match_threshold: 0.70,
              match_count: matchCount * 2,
              p_user_id: userId,
            });
            if (error) logger.warn('match_chat_memory RPC failed', { code: error.code });
            return data || [];
          }
          return [];
        })(),
        (async () => {
          if (!sanitizedQuery) return [];
          const { data, error } = await supabase
            .from('chat_memory')
            .select('id, content')
            .eq('user_id', userId)
            .textSearch('content', sanitizedQuery)
            .limit(matchCount * 2);
          return data || [];
        })()
      ]);

      const vectorMatches = vectorResult as ChatMemoryMatch[];
      const textMatches = textResult as ChatMemoryMatch[];

      if (!vectorMatches.length && !textMatches.length) return [];

      // App-level Reciprocal Rank Fusion (RRF)
      const k = 60;
      const scores = new Map<string, { content: string, score: number }>();

      vectorMatches.forEach((match: ChatMemoryMatch, idx: number) => {
        const score = 1 / (k + idx + 1);
        scores.set(match.id, { content: match.content, score });
      });

      textMatches.forEach((match: ChatMemoryMatch, idx: number) => {
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
