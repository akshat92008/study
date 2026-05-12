'use server';

import { createClient } from '@/lib/supabase/server';
import { getDueCards, getRevisionStats, reviewCard, generateCardsForConcept } from '@/lib/engines/revision-engine';

export async function getRevisionData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [due, stats] = await Promise.all([
    getDueCards(user.id),
    getRevisionStats(user.id),
  ]);

  return { due, stats };
}

export async function submitReview(cardId: string, rating: 1 | 2 | 3 | 4) {
  return reviewCard(cardId, rating);
}

export async function generateCards(conceptId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return generateCardsForConcept(user.id, conceptId, subject, chapter);
}
