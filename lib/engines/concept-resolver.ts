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
  // Create concept as fallback
  const insertData: any = { 
    user_id: userId, 
    subject: subject.trim(), 
    chapter: chapter.trim(), 
    name: chapter.trim(), 
    mastery: 'not_started',
    confidence: 'low'
  };
  
  if (embedding && embedding.length > 0) {
    insertData.embedding = `[${embedding.join(',')}]`;
  }

  const { data: newConcept, error: insertErr } = await supabase.from('concepts')
    .insert(insertData)
    .select('id')
    .single();
  
  if (insertErr) {
    logger.error('Failed to create fallback concept node', { userId, subject, chapter, error: insertErr });
  }

  if (newConcept?.id) {
    EventDispatcher.publish({
      user_id: userId,
      type: 'CONCEPT_DISCOVERED' as any, // Schema allows extending
      data: {
        parentConceptId: newConcept.id,
        subject: subject.trim(),
        chapter: chapter.trim(),
      },
      metadata: {
        source: 'concept_resolver',
        conceptId: newConcept.id,
      },
      idempotency_key: `concept:discover:${newConcept.id}`,
    }).catch(err => logger.error('Failed to trigger concept expansion', err));

    return newConcept.id;
  }
  return null;
}
