import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/gemini';

export async function resolveConceptByName(userId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  
  // Exact match first
  let { data } = await supabase.from('concepts').select('id')
    .eq('user_id', userId).eq('subject', subject).eq('chapter', chapter).limit(1).single();
  
  if (data) return data.id;
  
  // Fuzzy match via ilike
  const { data: fuzzy } = await supabase.from('concepts').select('id')
    .eq('user_id', userId).ilike('chapter', `%${chapter}%`).limit(1).single();
  
  if (fuzzy) return fuzzy.id;
  
  // Semantic match via pgvector (most expensive, most accurate)
  try {
    const embedding = await getEmbedding(`${subject} ${chapter}`);
    if (embedding) {
      const { data: semantic } = await supabase.rpc('match_concepts', {
        query_embedding: embedding, match_threshold: 0.6, match_count: 1, p_user_id: userId,
      });
      
      return semantic?.[0]?.id || null;
    }
  } catch (e) {
    console.error("Error resolving concept semantics", e);
  }
  
  return null;
}
