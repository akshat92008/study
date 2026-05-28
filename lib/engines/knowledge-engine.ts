import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const MASTERY_ORDER = ['not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated'];

const CATEGORY_MAP: Record<string, string> = {
  conceptual_gap: 'conceptual',
  calculation_error: 'calculation',
  silly_mistake: 'silly',
  time_pressure: 'time_pressure',
  misread_question: 'misread',
  incomplete_knowledge: 'incomplete_knowledge',
  overconfidence: 'overconfidence',
  anxiety_blank: 'anxiety',
  recall_failure: 'recall_failure',
};

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function mapMistakeCategory(category: unknown): string {
  if (typeof category !== 'string') return 'conceptual';
  return CATEGORY_MAP[category] ?? category;
}

function lowerMastery(current: unknown): string {
  const currentIndex = MASTERY_ORDER.indexOf(typeof current === 'string' ? current : 'not_started');
  if (currentIndex <= 1) return 'exposed';
  return MASTERY_ORDER[currentIndex - 1];
}

async function findOrCreateConcept(supabase: any, userId: string, question: any): Promise<string | null> {
  const subject = normalizeText(question.subject, 'General');
  const chapter = normalizeText(question.chapter, subject);
  const conceptName = normalizeText(question.conceptualGap, chapter);

  const { data: existing } = await supabase
    .from('concepts')
    .select('id, mastery, times_incorrect')
    .eq('user_id', userId)
    .ilike('subject', subject)
    .ilike('chapter', chapter)
    .ilike('name', conceptName)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from('concepts')
      .update({
        mastery: lowerMastery(existing.mastery),
        confidence: 'low',
        times_incorrect: (existing.times_incorrect || 0) + 1,
        forgetting_probability: 1,
        retention_strength: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('concepts')
    .insert({
      user_id: userId,
      name: conceptName,
      subject,
      chapter,
      topic: conceptName === chapter ? '' : conceptName,
      mastery: 'exposed',
      confidence: 'low',
      times_incorrect: 1,
      forgetting_probability: 1,
      retention_strength: 0,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to create concept from autopsy gap', {
      userId,
      subject,
      chapter,
      conceptName,
      error,
    });
    return null;
  }

  return created?.id ?? null;
}

export async function generateKnowledgeUpdate(
  userId: string,
  diagnosedIncorrect: any[]
): Promise<void> {
  if (!Array.isArray(diagnosedIncorrect) || diagnosedIncorrect.length === 0) return;

  const supabase = await createClient();
  let conceptsTouched = 0;
  let mistakesLogged = 0;

  for (const question of diagnosedIncorrect) {
    const subject = normalizeText(question.subject, 'General');
    const chapter = normalizeText(question.chapter, subject);
    const topic = normalizeText(question.conceptualGap, '');
    const conceptId = await findOrCreateConcept(supabase, userId, question);

    const { error } = await supabase.from('mistakes').insert({
      user_id: userId,
      concept_id: conceptId,
      category: mapMistakeCategory(question.mistakeCategory),
      subject,
      chapter,
      topic,
      question_text: question.questionText ?? null,
      user_answer: question.studentAnswer ?? null,
      correct_answer: question.correctAnswer ?? null,
      marks_lost: question.marksLost ?? 0,
      total_marks: question.totalMarks ?? 0,
      ai_analysis: question.reasoning ?? null,
      improvement_suggestion: question.correctExplanation ?? question.conceptualGap ?? null,
    });

    if (conceptId) conceptsTouched += 1;
    if (!error) {
      mistakesLogged += 1;
    } else {
      logger.warn('Failed to log autopsy mistake', {
        userId,
        conceptId,
        questionNumber: question.questionNumber,
        error,
      });
    }
  }

  logger.info('Autopsy knowledge update complete', {
    userId,
    diagnosedCount: diagnosedIncorrect.length,
    conceptsTouched,
    mistakesLogged,
  });
}
