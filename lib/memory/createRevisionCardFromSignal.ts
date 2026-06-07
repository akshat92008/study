import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import type { LearningSignal } from '@/lib/agentic/extractLearningSignals';

/**
 * Creates a durable MEMORY card from a learning signal.
 */
export async function createRevisionCardFromSignal(
  supabase: SupabaseClient,
  userId: string,
  conceptId: string,
  signal: LearningSignal
): Promise<string | null> {
  try {
    if (signal.type !== 'weak_area_detected' && signal.type !== 'misconception_detected') {
      return null;
    }

    // Deduplication: Check for existing active card for this concept
    const { data: existing } = await supabase
      .from('revision_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('concept_id', conceptId)
      .neq('state', 4) // Not buried
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Generate basic front/back if LLM didn't provide it
    // In a real implementation, we might call an LLM here to generate a high-quality card.
    // For now, we'll use a template based on the concept and evidence.
    let front = `What is ${signal.concept}?`;
    let back = `Based on your recent study, you were confused about ${signal.concept}. Review the core mechanism and exam context.`;

    if (signal.type === 'misconception_detected') {
      front = `Clarify: ${signal.concept}`;
      back = `You recently had a misconception about this: "${signal.misconception}". Correction: ${signal.correction}`;
    }

    const { data, error } = await supabase
      .from('revision_cards')
      .insert({
        user_id: userId,
        concept_id: conceptId,
        front,
        back,
        due: new Date().toISOString(),
        state: 0, // New
        stability: 0,
        difficulty: 5,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create revision card', { conceptId, error });
      return null;
    }

    return data.id;
  } catch (err) {
    logger.error('Unexpected error in createRevisionCardFromSignal', { userId, conceptId, error: err });
    return null;
  }
}
