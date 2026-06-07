import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import type { LearningSignal } from '@/lib/agentic/extractLearningSignals';

export interface MasteryUpdateResult {
  conceptId: string;
  previousMastery: number;
  newMastery: number;
  previousStatus: string;
  newStatus: string;
}

/**
 * Updates concept mastery based on a learning signal.
 */
export async function updateMasteryFromSignal(
  supabase: SupabaseClient,
  userId: string,
  conceptId: string,
  signal: LearningSignal
): Promise<MasteryUpdateResult | null> {
  try {
    const { data: concept, error: fetchError } = await supabase
      .from('concepts')
      .select('mastery, mastery_score')
      .eq('id', conceptId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !concept) {
      logger.error('Concept not found for mastery update', { conceptId, userId });
      return null;
    }

    const prevScore = Number(concept.mastery_score || 0);
    const prevStatus = concept.mastery || 'not_started';
    let newScore = prevScore;

    switch (signal.type) {
      case 'weak_area_detected':
        newScore = Math.min(prevScore, 0.3); // Mark as weak
        if (newScore === 0) newScore = 0.25;
        break;
      case 'misconception_detected':
        newScore = Math.min(prevScore, 0.2); // Mark as very weak
        if (newScore === 0) newScore = 0.15;
        break;
      case 'concept_understood':
        // Chat understanding is cautious
        newScore = Math.min(0.8, prevScore + 0.05); 
        break;
      default:
        return null;
    }

    // Map score to status
    let newStatus = 'weak';
    if (newScore < 0.35) newStatus = 'weak';
    else if (newScore < 0.7) newStatus = 'learning';
    else if (newScore < 0.9) newStatus = 'strong';
    else newStatus = 'ready';

    const { error: updateError } = await supabase
      .from('concepts')
      .update({
        mastery: newStatus,
        mastery_score: newScore,
        last_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conceptId);

    if (updateError) {
      logger.error('Failed to update concept mastery', { conceptId, updateError });
      return null;
    }

    // Log mastery event
    await supabase.from('mastery_events').insert({
      user_id: userId,
      concept_id: conceptId,
      old_mastery: prevStatus,
      new_mastery: newStatus,
      evidence: signal.evidence,
      evidence_type: signal.type,
      source: signal.type.includes('chat') ? 'chat' : 'system',
      confidence: signal.confidence
    });

    return {
      conceptId,
      previousMastery: prevScore,
      newMastery: newScore,
      previousStatus: prevStatus,
      newStatus
    };
  } catch (err) {
    logger.error('Unexpected error in updateMasteryFromSignal', { userId, conceptId, error: err });
    return null;
  }
}
