import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';
import { EventDispatcher } from '@/lib/events/orchestrator';

export async function resolveConceptByName(userId: string, subject: string, chapter: string): Promise<string | null> {
  const supabase = await createClient();
  const normalizedSubject = subject.trim().toLowerCase();
  const normalizedChapter = chapter.trim().toLowerCase();
  
  // 1. Case-insensitive exact match
  const { data: exact } = await supabase.from('concepts')
    .select('id').eq('user_id', userId)
    .ilike('subject', normalizedSubject)
    .ilike('chapter', normalizedChapter)
    .limit(1).single();
  
  if (exact) return exact.id;
  
  // 2. Fuzzy match via ilike on both subject and chapter (handles casing & minor variants)
  const { data: fuzzy } = await supabase.from('concepts')
    .select('id').eq('user_id', userId)
    .ilike('subject', `%${normalizedSubject}%`)
    .ilike('chapter', `%${normalizedChapter}%`)
    .limit(1)
    .single();
  
  if (fuzzy) return fuzzy.id;
  
  // 3. Semantic match via pgvector (Most expensive, fallback)
  let embedding: number[] | null = null;
  try {
    embedding = await getEmbedding(`${subject} ${chapter}`);
    if (embedding && embedding.length > 0) {
      const { data: semantic } = await supabase.rpc('match_concepts', {
        query_embedding: `[${embedding.join(',')}]`, 
        match_threshold: 0.6, 
        match_count: 1, 
        p_user_id: userId,
      });
      if (semantic && semantic.length > 0) return semantic[0].id;
    }
  } catch (e) {
    logger.warn("Semantic concept resolution query failed", { userId, subject, chapter });
  }
  
  // 4. Log the miss extensively for analysis!
  logger.warn('CONCEPT_RESOLVER_MISS', { userId, subject, chapter, reason: 'No exact, fuzzy, or semantic matches located in DB.' });
  
  // Constrain auto-creation of new concept nodes to prevent DB bloat from LLM hallucinations.
  // The system should rely on explicit curriculum ingestion rather than lazy auto-creation.
  return null;
}
