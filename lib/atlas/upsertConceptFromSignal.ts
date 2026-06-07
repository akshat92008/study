import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export interface ConceptUpsertInput {
  userId: string;
  conceptName: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  goalId?: string | null;
}

/**
 * Upserts a concept into the ATLAS concepts table.
 * Relies on the database trigger to set canonical fields and concept_key.
 */
export async function upsertConceptFromSignal(
  supabase: SupabaseClient,
  input: ConceptUpsertInput
): Promise<string | null> {
  try {
    const { userId, conceptName, subject, chapter, topic, goalId } = input;

    // Use a simplified concept_key if we want to be safe with 'on conflict',
    // but the trigger set_concept_canonical_fields usually handles this.
    // We'll perform an insert with on conflict on (user_id, concept_key).
    // To do that we need to know what the concept_key will be.
    // Based on migration: coalesce(subject, 'general') :: coalesce(chapter, 'general') :: coalesce(name, topic, chapter, 'general')
    
    // Actually, it's safer to use the 'match_concepts' RPC or just try to find by name first
    // if we don't want to re-implement the normalization logic here.
    
    const { data: existing } = await supabase
      .from('concepts')
      .select('id')
      .eq('user_id', userId)
      .eq('name', conceptName)
      .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabase
      .from('concepts')
      .insert({
        user_id: userId,
        name: conceptName,
        subject: subject || 'General',
        chapter: chapter || 'General',
        topic: topic || conceptName,
        goal_id: goalId || null,
        mastery: 'not_started',
        mastery_score: 0,
        confidence: 'low'
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        const { data: retry } = await supabase
          .from('concepts')
          .select('id')
          .eq('user_id', userId)
          .eq('name', conceptName)
          .single();
        return retry?.id || null;
      }
      logger.error('upsertConceptFromSignal failed', { input, error });
      return null;
    }

    return data.id;
  } catch (err) {
    logger.error('Unexpected error in upsertConceptFromSignal', { input, error: err });
    return null;
  }
}
