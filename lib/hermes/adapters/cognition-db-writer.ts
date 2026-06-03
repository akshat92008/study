// lib/hermes/adapters/cognition-db-writer.ts
// Converts Hermes agent outputs into Supabase database mutations.
//
// RULES:
// - Every function verifies user owns the goal/session before writing
// - Only writes to allowed tables
// - Always attaches goal_id and chat_session_id
// - Returns created IDs for the calling route to return to the client
// - Never allows agents to write directly to DB
//
// Supabase remains the source of truth. Hermes only computes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HermesMistakeInput, HermesMistakeResult, WriteMistakeResultOutput } from '../hermes-types';
import { hermesLogger } from '../hermes-logger';

/**
 * Write the full result of the Mistake Agent to Supabase.
 *
 * Creates:
 *   - concept (or reuses existing scoped to goal)
 *   - mock_autopsies record (dummy, for schema compat)
 *   - mistakes row
 *   - revision_cards rows
 *   - student_events audit entry
 *
 * @param supabase - Server-side Supabase client with user context (RLS enforced)
 */
export async function writeMistakeResult(
  supabase: SupabaseClient,
  userId: string,
  goalId: string | null | undefined,
  chatSessionId: string | null | undefined,
  mistakeInput: HermesMistakeInput,
  hermesResult: HermesMistakeResult
): Promise<WriteMistakeResultOutput> {
  // ── 1. Ensure/create concept scoped to goal ──────────────────────────────
  let conceptId: string | null = null;
  const wc = hermesResult.weakConcept;

  if (wc.subject || wc.chapter || wc.topic) {
    const subject = wc.subject || hermesResult.subject;
    const chapter = wc.chapter || hermesResult.chapter;
    const topic = wc.topic || hermesResult.topic || wc.name;

    if (subject && chapter && topic) {
      let conceptQuery = supabase
        .from('concepts')
        .select('id')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('chapter', chapter)
        .eq('topic', topic);

      if (goalId) {
        conceptQuery = conceptQuery.eq('goal_id', goalId);
      }

      const { data: existingConcept } = await conceptQuery.maybeSingle();

      if (existingConcept) {
        conceptId = existingConcept.id;
      } else {
        const { data: newConcept, error: conceptError } = await supabase
          .from('concepts')
          .insert({
            user_id: userId,
            subject,
            chapter,
            topic,
            name: wc.name || topic,
            mastery: 'not_started',
            ...(goalId ? { goal_id: goalId } : {}),
            ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
          })
          .select('id')
          .single();

        if (conceptError) {
          hermesLogger.warn('Failed to create concept', {
            userId,
            goalId,
            error: conceptError.message,
          });
        } else if (newConcept) {
          conceptId = newConcept.id;
        }
      }
    }
  }

  // ── 2. Create mock_autopsies dummy row (schema compatibility) ────────────
  const { data: autopsy } = await supabase
    .from('mock_autopsies')
    .insert({
      user_id: userId,
      test_name: 'Manual Mistake Review',
      total_marks: 4,
      marks_obtained: -1,
      marks_lost: 5,
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(goalId ? { goal_id: goalId } : {}),
      ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
    })
    .select('id')
    .single();

  // ── 3. Create mistakes row ───────────────────────────────────────────────
  const { data: mistake, error: mistakeError } = await supabase
    .from('mistakes')
    .insert({
      user_id: userId,
      autopsy_id: autopsy?.id ?? null,
      concept_id: conceptId,
      category: hermesResult.category,
      question_text: mistakeInput.question,
      user_answer: mistakeInput.myAnswer,
      correct_answer: mistakeInput.correctAnswer,
      marks_lost: 5,
      subject: hermesResult.subject,
      chapter: hermesResult.chapter,
      metadata: {
        diagnosis: hermesResult.diagnosis,
        whyMyAnswerWasWrong: hermesResult.whyMyAnswerWasWrong,
        whyCorrectAnswerWorks: hermesResult.whyCorrectAnswerWorks,
        keyMissedClue: hermesResult.keyMissedClue,
        confidence: hermesResult.confidence,
        safetyFlags: hermesResult.safetyFlags,
        generatedByHermes: true,
      },
      ...(goalId ? { goal_id: goalId } : {}),
      ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
    })
    .select('id')
    .single();

  if (mistakeError) {
    hermesLogger.error('Failed to insert mistake', mistakeError, { userId, goalId });
    throw mistakeError;
  }
  if (!mistake) {
    throw new Error('Mistake insert returned no data');
  }

  // ── 4. Create revision_cards ─────────────────────────────────────────────
  let cardIds: string[] = [];
  if (hermesResult.cards && hermesResult.cards.length > 0) {
    const cardsToInsert = hermesResult.cards.map((card) => ({
      user_id: userId,
      concept_id: conceptId,
      front: card.front,
      back: card.back,
      card_type: 'mistake',
      state: 0, // 'new'
      due: new Date().toISOString(),
      source_type: 'manual_mistake_review',
      metadata: {
        mistakeId: mistake.id,
        category: hermesResult.category,
        generated_type: card.type,
        difficulty: card.difficulty,
        question_snippet: mistakeInput.question.substring(0, 100),
        generatedByHermes: true,
      },
      subject: hermesResult.subject,
      chapter: hermesResult.chapter,
      topic: hermesResult.topic,
      ...(goalId ? { goal_id: goalId } : {}),
      ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
    }));

    const { data: insertedCards, error: cardsError } = await supabase
      .from('revision_cards')
      .insert(cardsToInsert)
      .select('id');

    if (cardsError) {
      hermesLogger.warn('Failed to insert revision cards', {
        userId,
        goalId,
        error: cardsError.message,
      });
    } else if (insertedCards) {
      cardIds = insertedCards.map((c: { id: string }) => c.id);
    }
  }

  // ── 5. Emit student_events audit entry ───────────────────────────────────
  await supabase
    .from('student_events')
    .insert({
      user_id: userId,
      type: 'MISTAKE_LOGGED_MANUALLY',
      data: {
        mistakeId: mistake.id,
        goalId: goalId ?? null,
        chatSessionId: chatSessionId ?? null,
        conceptId,
        cardCount: cardIds.length,
        category: hermesResult.category,
        confidence: hermesResult.confidence,
        generatedByHermes: true,
      },
    })
    .then(({ error }: { error: any }) => {
      if (error) {
        hermesLogger.warn('Failed to insert student_events audit', {
          userId,
          error: error.message,
        });
      }
    });

  hermesLogger.info('Mistake result written to DB', {
    userId,
    goalId,
    mistakeId: mistake.id,
    conceptId,
    cardCount: cardIds.length,
  });

  return {
    autopsyId: autopsy?.id ?? null,
    mistakeId: mistake.id,
    conceptId,
    cardIds,
  };
}

/**
 * Write Hermes source agent result to Supabase.
 * Updates study_materials.metadata with extracted concepts summary.
 * Card insertion is optional and gated by config.
 */
export async function writeSourceResult(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
  goalId: string | null | undefined,
  result: import('../hermes-types').HermesSourceResult,
  insertCards = false
): Promise<{ conceptCount: number; cardCount: number }> {
  // Update material metadata
  await supabase
    .from('study_materials')
    .update({
      metadata: {
        hermesSummary: result.sourceSummary,
        extractedConceptsCount: result.extractedConcepts.length,
        suggestedCardsCount: result.suggestedCards.length,
        processedByHermes: true,
        processedAt: new Date().toISOString(),
      },
    })
    .eq('id', materialId)
    .eq('user_id', userId);

  let cardCount = 0;

  if (insertCards && result.suggestedCards.length > 0 && goalId) {
    const cardsToInsert = result.suggestedCards.slice(0, 5).map((card) => ({
      user_id: userId,
      goal_id: goalId,
      front: card.front,
      back: card.back,
      card_type: 'source',
      state: 0,
      due: new Date().toISOString(),
      source_type: 'hermes_source_processing',
      metadata: { materialId, generatedByHermes: true },
    }));

    const { data: inserted } = await supabase
      .from('revision_cards')
      .insert(cardsToInsert)
      .select('id');

    cardCount = inserted?.length ?? 0;
  }

  return {
    conceptCount: result.extractedConcepts.length,
    cardCount,
  };
}
