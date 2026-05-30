import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { resolveConcept } from '@/lib/engines/concept-resolver';

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

async function resolveAutopsyConcept(supabase: any, userId: string, question: any): Promise<string | null> {
  const subject = normalizeText(question.subject, 'General');
  const chapter = normalizeText(question.chapter, subject);
  const conceptName = normalizeText(question.conceptualGap, chapter);

  const resolution = await resolveConcept({
    userId,
    subject,
    chapter,
    topic: conceptName,
    questionText: question.questionText ?? null,
    sourceType: 'autopsy',
    confidence: typeof question.ocrConfidence === 'number'
      ? Math.max(0.1, Math.min(1, question.ocrConfidence / 100))
      : 0.75,
    client: supabase,
  });

  return resolution.conceptId;
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
    const extractionConfidence =
      typeof question.ocrConfidence === 'number' ? question.ocrConfidence :
      typeof question.extractionConfidence === 'number' ? question.extractionConfidence :
      100;
    if (question.needsReview || extractionConfidence < 70) {
      logger.warn('Skipping low-confidence autopsy knowledge update', {
        userId,
        questionNumber: question.questionNumber,
        extractionConfidence,
      });
      continue;
    }

    const subject = normalizeText(question.subject, 'General');
    const chapter = normalizeText(question.chapter, subject);
    const topic = normalizeText(question.conceptualGap, '');
    const conceptId = await resolveAutopsyConcept(supabase, userId, question);

    if (question.autopsyId && question.questionNumber) {
      const { data: existingMistake } = await supabase
        .from('mistakes')
        .select('id')
        .eq('user_id', userId)
        .eq('source_autopsy_id', question.autopsyId)
        .eq('source_question_number', question.questionNumber)
        .maybeSingle();
      if (existingMistake) continue;
    }

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
      source_autopsy_id: question.autopsyId ?? null,
      source_question_number: question.questionNumber ?? null,
      extraction_confidence: extractionConfidence,
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
