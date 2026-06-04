import { parse } from 'csv-parse/sync';
import { computeQuestionStatus } from '../scoring';
import type { AssessmentQuestionRecord } from '../types';

export function parseQuestionsCsv(input: string, userId: string, assessmentId: string): AssessmentQuestionRecord[] {
  const rows = parse(input, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  return rows.map((row, index) => {
    const questionNumber = Number(row.question_number ?? row.questionNumber ?? row.q ?? index + 1);
    const correctAnswer = row.correct_answer ?? row.correctAnswer ?? row.answer_key ?? row.answer ?? null;
    const userAnswer = row.user_answer ?? row.userAnswer ?? row.my_answer ?? row.student_answer ?? null;
    const options = parseOptions(row.options);

    return {
      assessment_id: assessmentId,
      user_id: userId,
      question_number: Number.isInteger(questionNumber) && questionNumber > 0 ? questionNumber : index + 1,
      subject: row.subject || null,
      topic: row.topic || row.chapter || null,
      subtopic: row.subtopic || null,
      question_text: row.question_text ?? row.questionText ?? row.question ?? null,
      options,
      correct_answer: correctAnswer,
      user_answer: userAnswer,
      status: computeQuestionStatus(correctAnswer, userAnswer, options),
      difficulty: normalizeDifficulty(row.difficulty),
      user_reviewed: true,
      metadata: { source: 'csv' },
    };
  });
}

function parseOptions(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) || typeof parsed === 'object' ? parsed : null;
  } catch {
    const split = value.split(/\s*\|\s*/).filter(Boolean);
    return split.length > 0 ? split : null;
  }
}

function normalizeDifficulty(value?: string | null) {
  const normalized = value?.toLowerCase().trim();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') return normalized;
  return normalized ? 'unknown' : null;
}
