import { createEmptyCard, fsrs, Rating, type Card as FSRSCard } from 'ts-fsrs';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';

const scheduler = fsrs({
  request_retention: 0.9, // Target 90% retention
  maximum_interval: 365,
});

// Convert DB row to FSRS Card
function toFSRSCard(row: any): FSRSCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  } as FSRSCard;
}

// Get cards due for review
export async function getDueCards(userId: string, limit: number = 20) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId)
    .lte('due', now)
    .order('due', { ascending: true })
    .limit(limit);

  return data || [];
}

// Get all cards with stats
export async function getRevisionStats(userId: string) {
  const supabase = await createClient();

  const { data: allCards } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId);

  const cards = allCards || [];
  const due = cards.filter(c => new Date(c.due) <= new Date());
  const newCards = cards.filter(c => c.state === 0);
  const learning = cards.filter(c => c.state === 1 || c.state === 3);
  const mature = cards.filter(c => c.state === 2 && c.stability > 21);

  return {
    total: cards.length,
    due: due.length,
    new: newCards.length,
    learning: learning.length,
    mature: mature.length,
    averageRetention: cards.length > 0
      ? Math.round(cards.reduce((sum, c) => sum + (1 - (c.forgetting_probability || 0)), 0) / cards.length * 100)
      : 0,
  };
}

// Review a card — apply FSRS algorithm
export async function reviewCard(cardId: string, rating: 1 | 2 | 3 | 4) {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('id', cardId)
    .single();

  if (!row) throw new Error('Card not found');

  const fsrsCard = toFSRSCard(row);
  const now = new Date();
  const ratingMap: Record<number, Rating> = {
    1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy,
  };

  const result = scheduler.next(fsrsCard, now, ratingMap[rating]);
  const updated = result.card;

  // Update card in DB
  await supabase.from('revision_cards').update({
    due: updated.due.toISOString(),
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    reps: updated.reps,
    lapses: updated.lapses,
    state: updated.state,
    last_review: now.toISOString(),
  }).eq('id', cardId);

  // Log the review
  await supabase.from('review_logs').insert({
    user_id: row.user_id,
    card_id: cardId,
    rating,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    state: updated.state,
  });

  return { nextDue: updated.due, scheduledDays: updated.scheduled_days };
}

// Generate revision cards from a concept using AI
export async function generateCardsForConcept(userId: string, conceptId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  const prompt = `Generate 5 flashcard-style revision questions for ${examType} ${subject}, chapter: "${chapter}".

Each card should test a key concept that is important for ${examType} exams.
Mix question types: definition, application, numerical, comparison.

Respond as JSON array:
[
  { "front": "question text (can include LaTeX with $...$)", "back": "answer with explanation" }
]`;

  const cards = await generateJSON<Array<{ front: string; back: string }>>('flash',
    `You are an expert ${examType} exam content creator.`, prompt);

  const emptyCard = createEmptyCard();

  const rows = (cards || []).map(c => ({
    user_id: userId,
    concept_id: conceptId,
    front: c.front,
    back: c.back,
    subject,
    chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
  }));

  const { data } = await supabase.from('revision_cards').insert(rows).select();
  return data;
}
