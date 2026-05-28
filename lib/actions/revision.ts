'use server';

import { createClient } from '@/lib/supabase/server';
import { getDueCards, getRevisionStats, reviewCard, generateCardsForConcept } from '@/lib/engines/revision-engine';
import { logger } from '@/lib/utils/logger';

export async function getRevisionData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const [due, stats, allCardsRes] = await Promise.all([
      getDueCards(user.id),
      getRevisionStats(user.id),
      supabase.from('revision_cards')
        .select('id, due, stability, difficulty, state, subject, chapter')
        .eq('user_id', user.id),
    ]);

    return { due, stats, allCards: allCardsRes.data || [] };
  } catch (error) {
    logger.error('Failed to fetch revision data', error);
    return null;
  }
}

export async function submitReview(cardId: string, rating: 1 | 2 | 3 | 4, responseTimeMs?: number) {
  try {
    // Validate ID format basic check
    if (!cardId || typeof rating !== 'number') throw new Error('Invalid input');
    
    return await reviewCard(cardId, rating, responseTimeMs);
  } catch (error) {
    logger.error('Review submission failed', error);
    throw new Error('Failed to save review. Please try again.');
  }
}

export async function generateCards(conceptId: string, subject: string, chapter: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    
    return await generateCardsForConcept(user.id, conceptId, subject, chapter);
  } catch (error: any) {
    logger.error('Card generation failed', error);
    throw new Error(error.message || 'Generation failed');
  }
}
