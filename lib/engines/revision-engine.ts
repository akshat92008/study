import { createEmptyCard, fsrs, Rating, State, type Card as FSRSCard } from 'ts-fsrs';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { searchPersonalKnowledge } from './rag-engine';
import { FlashcardBatchSchema } from './memory-schemas';
import { logger } from '@/lib/utils/logger';

// FSRS-5 Configuration tuned for competitive exams
const scheduler = fsrs({
  request_retention: 0.90, // Target 90% retention (Optimal for NEET/JEE)
  maximum_interval: 365,   // Cap max interval to 1 year to prevent extreme drop-offs
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61], // Standard FSRS v5 weights
});

function toFSRSCard(row: any): FSRSCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export async function getDueCards(userId: string, limit: number = 75, pulseState: string = 'neutral') {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // HARD CAP: Default to 75 cards max (~15-25 minutes per day).
  // Prioritize Overdue Recovery: 
  // Oldest due date first, then highest difficulty to rescue at-risk memories, 
  // then lowest stability (weakness reinforcement).
  
  let query = supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId)
    .lte('due', now);

  // PULSE Intervention: Throttle new cognitive load if overwhelmed/frustrated
  if (pulseState === 'overwhelmed' || pulseState === 'frustrated') {
    query = query.neq('state', State.New);
  }

  const { data } = await query
    .order('due', { ascending: true })
    .order('difficulty', { ascending: false })
    .order('stability', { ascending: true })
    .limit(limit);

  return data || [];
}

export async function getRevisionStats(userId: string) {
  const supabase = await createClient();

  const { data: cards } = await supabase.from('revision_cards').select('due, state, stability').eq('user_id', userId);
  if (!cards) return { total: 0, due: 0, new: 0, learning: 0, mature: 0, averageRetention: 0 };

  const due = cards.filter(c => new Date(c.due) <= new Date());
  const newCards = cards.filter(c => c.state === State.New);
  const learning = cards.filter(c => c.state === State.Learning || c.state === State.Relearning);
  const mature = cards.filter(c => c.state === State.Review && c.stability > 21);

  return {
    total: cards.length,
    due: due.length,
    new: newCards.length,
    learning: learning.length,
    mature: mature.length,
    averageRetention: cards.length > 0 ? 90 : 0, // FSRS targets 90% dynamically
  };
}

export async function reviewCard(cardId: string, rating: 1 | 2 | 3 | 4, responseTimeMs?: number) {
  const supabase = await createClient();
  
  // 1. Fetch Card
  const { data: row } = await supabase.from('revision_cards').select('*').eq('id', cardId).single();
  if (!row) throw new Error('Card not found');

  const fsrsCard = toFSRSCard(row);
  const now = new Date();
  
  const ratingMap: Record<number, Rating> = {
    1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy,
  };

  // 2. Execute FSRS-5 Math
  const result = scheduler.next(fsrsCard, now, ratingMap[rating] as any);
  const updated = result.card;

  // 3. Update Card DB
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

  // 4. Log Review Telemetry
  await supabase.from('review_logs').insert({
    user_id: row.user_id,
    card_id: cardId,
    rating,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    state: updated.state,
    response_time_ms: responseTimeMs,
  });

  // Log PULSE friction signal if response time degrades significantly (> 15s)
  if (responseTimeMs && responseTimeMs > 15000) {
    try {
      await supabase.from('pulse_signals').insert({
        user_id: row.user_id,
        signal_type: 'performance_trend',
        emotional_state: 'frustrated',
        confidence: 0.7,
        notes: `Slow revision response time: ${responseTimeMs}ms`,
      });
    } catch (e) {
      logger.error('Failed to log slow response time pulse signal', e);
    }
  }

  // 5. Sync Ecosystem: Update parent Concept Mastery & Streak
  if (row.concept_id) {
    let newMastery = 'developing';
    if (updated.state === State.Review) {
      if (updated.stability > 21) newMastery = 'automated';
      else if (updated.stability > 7) newMastery = 'mastered';
      else newMastery = 'proficient';
    } else if (updated.state === State.New) {
      newMastery = 'exposed';
    }

    await supabase.from('concepts').update({
      mastery: newMastery,
      last_reviewed_at: now.toISOString(),
      times_reviewed: row.reps + 1,
    }).eq('id', row.concept_id);

    // 5b. Loop-Breaker: Repeated Failures (> 3 lapses)
    if (updated.lapses > 3 && rating === 1) {
      try {
        const { data: concept } = await supabase.from('concepts').select('subject, chapter').eq('id', row.concept_id).single();
        if (concept) {
          // Suspend card or flag it (using 4 for suspended)
          await supabase.from('revision_cards').update({ state: 4 }).eq('id', cardId);
          
          // Inject deep review task into COMMAND planner
          const d = new Date();
          d.setDate(d.getDate() + 1); // schedule for tomorrow
          await supabase.from('study_tasks').insert({
            user_id: row.user_id,
            title: `[Deep Review Required] Repeated failures on ${concept.chapter}. Trigger MIND Tutor session.`,
            scheduled_date: d.toISOString(),
            estimated_minutes: 30,
            priority: 4, // High priority
            is_completed: false
          });
          logger.info('Repeated failure loop-breaker triggered. Card suspended, MIND session scheduled.', { cardId, concept_id: row.concept_id });
        }
      } catch (e) {
        logger.error('Failed to trigger repeated failure loop-breaker', e);
      }
    }
  }

  // 6. Update Daily Performance Telemetry (Accuracy tracking)
  const today = now.toISOString().split('T')[0];
  const { data: snapshot } = await supabase.from('performance_snapshots')
    .select('id, questions_attempted, questions_correct').eq('user_id', row.user_id).eq('date', today).single();

  const isCorrect = rating > 1; // 2, 3, 4 count as correct recall
  
  if (snapshot) {
    await supabase.from('performance_snapshots').update({
      questions_attempted: snapshot.questions_attempted + 1,
      questions_correct: snapshot.questions_correct + (isCorrect ? 1 : 0),
      concepts_revised: snapshot.questions_attempted + 1, // rough mapping
    }).eq('id', snapshot.id);
  } else {
    await supabase.from('performance_snapshots').insert({
      user_id: row.user_id,
      date: today,
      questions_attempted: 1,
      questions_correct: isCorrect ? 1 : 0,
      concepts_revised: 1,
    });
  }

  logger.info(`Card Reviewed`, { cardId, rating, newState: updated.state, newDue: updated.due });

  return { nextDue: updated.due, scheduledDays: updated.scheduled_days };
}

// RAG-Driven Auto Card Generation
export async function generateCardsForConcept(
  userId: string, 
  conceptId: string, 
  subject: string, 
  chapter: string, 
  maxCards: number = 5 // Added dynamic limit parameter
) {
  const supabase = await createClient();
  
  // 1. Fetch Context from Student's Uploaded Materials via RAG
  const searchQuery = `${subject} ${chapter} core concepts and formulas`;
  const relevantChunks = await searchPersonalKnowledge(userId, searchQuery, 0.4, 4);
  
  const ragContext = relevantChunks.length > 0 
    ? `SOURCE MATERIAL:\n${relevantChunks.map((c: any) => c.chunk_text).join('\n\n')}`
    : `*No personal materials uploaded. Use general expert knowledge for ${subject}: ${chapter}.*`;

  // 2. Strict Prompting
  const prompt = `
    You are an elite automated flashcard extraction engine.
    Extract exactly ${maxCards} high-yield flashcards for the chapter: "${chapter}" (${subject}).
    
    CRITICAL INSTRUCTIONS:
    - Base the questions strictly on the SOURCE MATERIAL provided below if available.
    - If no source material is provided, use your expert knowledge.
    - Mix question types: Definitions, Formulas/Application, and Conceptual.
    - Keep answers concise and direct.
    - Format mathematical equations using LaTeX inside $...$ or $$...$$.
    
    ${ragContext}
  `;

  // 3. Generate with Zod Schema & Retries
  const result = await generateJSON('pro', 'You are an expert curriculum extraction engine.', prompt, FlashcardBatchSchema);

  if (!result || !result.cards || result.cards.length === 0) {
    logger.error('Failed to generate cards', { conceptId });
    throw new Error('AI failed to generate valid flashcards. Please try again.');
  }

  // 4. Inject into FSRS DB
  const emptyCard = createEmptyCard();
  
  const rows = result.cards.slice(0, maxCards).map((c: { front: string; back: string }) => ({
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

  const { data, error } = await supabase.from('revision_cards').insert(rows).select();
  if (error) throw new Error('Failed to save generated cards to database.');

  logger.info(`Auto-generated ${rows.length} cards via RAG`, { conceptId });
  return data;
}

export async function createCardFromMistake(
  userId: string,
  conceptId: string | null,
  subject: string,
  chapter: string,
  question: string,
  correctAnswer: string,
  reasoning: string
) {
  const supabase = await createClient();
  const emptyCard = createEmptyCard();
  
  const { error } = await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front: `[Mistake Recovery]\n${question}`,
    back: `Correct: ${correctAnswer}\n\nWhy you got it wrong: ${reasoning}`,
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
  });

  if (error) {
    logger.error('Failed to create flashcard from mistake', { error: error.message });
  } else {
    logger.info('Auto-generated card from mistake', { chapter });
  }
}

export async function createSingleCard(
  userId: string,
  conceptId: string,
  front: string,
  back: string,
  subject: string,
  chapter: string
) {
  const supabase = await createClient();
  const emptyCard = createEmptyCard();
  
  const { data, error } = await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front: `[Tutor Gap] ${front}`, // Tag it so the student knows where it came from
    back,
    subject,
    chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty + 0.2, // Slight difficulty bump for tutor-identified gaps
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
  }).select().single();
  
  if (error) {
    logger.error('Failed to create single flashcard from tutor session', error);
    return null; // Don't crash the tutor session if card creation fails
  }
  
  return data;
}

// Exam Mode (Cramming) - Bypasses FSRS due dates
export async function getExamModeCards(userId: string, subject: string, limit: number = 100) {
  const supabase = await createClient();

  // Pulls all cards for a specific subject, prioritizing the weakest (lowest stability)
  const { data } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId)
    .ilike('subject', `%${subject}%`)
    .neq('state', 4) // Exclude suspended cards (state = 4)
    .order('stability', { ascending: true }) // Weakest memories first
    .limit(limit);

  return data || [];
}

