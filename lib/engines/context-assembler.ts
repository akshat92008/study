// lib/engines/context-assembler.ts
// Full replacement — removes all stub/dummy data, wires real data sources.

import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

interface MemoryItem {
  id: string;
  content: string;
  score: number;
}

/**
 * ContextAssembler — builds enriched prompt context for LLM calls.
 * Replaces all stub implementations with real Supabase queries.
 */
export class ContextAssembler {
  async assemble(userId: string, input: string): Promise<string> {
    try {
      const [rawMemories, learnerState] = await Promise.all([
        this.retrieveMemories(userId, input),
        this.fetchLearnerState(userId),
      ]);

      const rankedMemories = this.rankMemories(rawMemories);
      const enriched = this.injectLearnerState(learnerState, rankedMemories);
      const compressed = this.compressPrompt(enriched, input);
      return compressed;
    } catch (err) {
      logger.error('ContextAssembler.assemble failed', { userId, err });
      // Graceful fallback: return just the user input so the LLM still responds
      return `User: ${input}`;
    }
  }

  /**
   * Real implementation: semantic search against chat_memory_embeddings via pgvector.
   */
  private async retrieveMemories(userId: string, query: string): Promise<MemoryItem[]> {
    try {
      const supabase = await createClient();
      const embedding = await getEmbedding(query);
      if (!embedding || embedding.length === 0) return [];

      const embeddingString = `[${embedding.join(',')}]`;

      const { data, error } = await supabase.rpc('match_chat_memory', {
        query_embedding: embeddingString,
        match_threshold: 0.72,
        match_count: 5,
        p_user_id: userId,
      });

      if (error) {
        // RPC not deployed yet — silent fallback, not a crash
        if (error.code === 'PGRST202') {
          logger.warn('match_chat_memory RPC not found, skipping semantic retrieval');
          return [];
        }
        logger.error('Memory retrieval RPC error', error);
        return [];
      }

      return (data || []).map((row: any, i: number) => ({
        id: row.id || `mem-${i}`,
        content: row.content,
        score: row.similarity ?? 0.5,
      }));
    } catch (err) {
      logger.warn('Memory retrieval failed, continuing without context', err);
      return [];
    }
  }

  /**
   * Real implementation: fetch mastery and emotional state from Supabase.
   */
  private async fetchLearnerState(userId: string): Promise<{
    emotionalState: string;
    masteryLevel: string;
    recentTopics: string[];
    examType: string;
  }> {
    try {
      const supabase = await createClient();

      const { data: profile } = await supabase
        .from('profiles')
        .select('emotional_state, exam_type')
        .eq('id', userId)
        .single();

      const { data: recentConcepts } = await supabase
        .from('concepts')
        .select('name, mastery_level')
        .eq('user_id', userId)
        .order('last_reviewed', { ascending: false })
        .limit(5);

      const avgMastery = recentConcepts?.length
        ? recentConcepts.reduce((sum: number, c: any) => sum + (c.mastery_level || 0), 0) / recentConcepts.length
        : 0;

      const masteryLevel =
        avgMastery >= 0.8 ? 'advanced' :
        avgMastery >= 0.5 ? 'intermediate' : 'beginner';

      return {
        emotionalState: profile?.emotional_state || 'neutral',
        masteryLevel,
        recentTopics: (recentConcepts || []).map((c: any) => c.name),
        examType: profile?.exam_type || 'General',
      };
    } catch (err) {
      logger.warn('fetchLearnerState failed, using defaults', err);
      return { emotionalState: 'neutral', masteryLevel: 'intermediate', recentTopics: [], examType: 'General' };
    }
  }

  private rankMemories(memories: MemoryItem[]): MemoryItem[] {
    return memories.sort((a, b) => b.score - a.score);
  }

  private injectLearnerState(
    state: { emotionalState: string; masteryLevel: string; recentTopics: string[]; examType: string },
    memories: MemoryItem[]
  ): string {
    const memoryBlock = memories.length > 0
      ? `RELEVANT PAST CONTEXT:\n${memories.map((m) => `- ${m.content}`).join('\n')}`
      : '';

    return [
      memoryBlock,
      `LEARNER STATE: mastery=${state.masteryLevel}, mood=${state.emotionalState}, exam=${state.examType}`,
      state.recentTopics.length > 0
        ? `RECENTLY STUDIED: ${state.recentTopics.join(', ')}`
        : '',
    ].filter(Boolean).join('\n');
  }

  private compressPrompt(enrichedContext: string, userInput: string): string {
    const MAX_CHARS = 6000; // ~1500 tokens — leaves room for the system prompt and response
    const full = `${enrichedContext}\nUser: ${userInput}`;
    if (full.length <= MAX_CHARS) return full;
    // Trim from the middle of enrichedContext, always keep full userInput at the end
    const budget = MAX_CHARS - userInput.length - 10;
    return `${enrichedContext.slice(0, budget)}...\nUser: ${userInput}`;
  }
}
