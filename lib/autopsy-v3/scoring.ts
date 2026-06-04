import { DEFAULT_CORRECT_MARKS, DEFAULT_NEGATIVE_MARKS } from './constants';
import type { AssessmentQuestionRecord, QuestionStatus } from './types';

const NUMBER_TO_OPTION: Record<string, string> = {
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
};

function stripAnswerNoise(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(option|answer|ans|choice|the correct answer is)\b/g, '')
    .replace(/^[\s:.)\]-]+|[\s:.)\]-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAnswer(value?: string | null): string {
  if (!value) return '';
  const cleaned = stripAnswerNoise(value);
  if (!cleaned) return '';

  const simple = cleaned.replace(/[^a-z0-9]/g, '');
  if (NUMBER_TO_OPTION[simple]) return NUMBER_TO_OPTION[simple];
  if (/^[abcd]$/i.test(simple)) return simple.toLowerCase();

  const optionMatch = cleaned.match(/\b([abcd])\b/i);
  if (optionMatch && cleaned.length <= 12) return optionMatch[1].toLowerCase();

  return cleaned;
}

export function answersEquivalent(userAnswer?: string | null, correctAnswer?: string | null, options?: unknown): boolean {
  const user = normalizeAnswer(userAnswer);
  const correct = normalizeAnswer(correctAnswer);
  if (!user || !correct) return false;
  if (user === correct) return true;

  if (Array.isArray(options)) {
    const correctOption = optionTextForAnswer(correct, options);
    const userOption = optionTextForAnswer(user, options);
    if (correctOption && userOption && correctOption === userOption) return true;
    if (correctOption && normalizeAnswer(userAnswer) === correctOption) return true;
  }

  return false;
}

function optionTextForAnswer(answer: string, options: unknown[]): string | null {
  const index = ['a', 'b', 'c', 'd'].indexOf(answer);
  if (index >= 0 && options[index] != null) return normalizeAnswer(String(options[index]));
  const numeric = Number(answer);
  if (Number.isInteger(numeric) && numeric > 0 && options[numeric - 1] != null) {
    return normalizeAnswer(String(options[numeric - 1]));
  }
  return null;
}

export function computeQuestionStatus(
  correctAnswer?: string | null,
  userAnswer?: string | null,
  options?: unknown
): QuestionStatus {
  const user = normalizeAnswer(userAnswer);
  const correct = normalizeAnswer(correctAnswer);

  if (!user || ['blank', 'skipped', 'unattempted', 'na', 'n/a', '-'].includes(user)) {
    return 'skipped';
  }

  if (!correct) return 'unknown';
  return answersEquivalent(userAnswer, correctAnswer, options) ? 'correct' : 'incorrect';
}

export function scoreQuestions(
  questions: AssessmentQuestionRecord[],
  correctMarks = DEFAULT_CORRECT_MARKS,
  negativeMarks = DEFAULT_NEGATIVE_MARKS
) {
  let scoredMarks = 0;
  let totalMarks = 0;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let unknown = 0;

  for (const question of questions) {
    const status = question.status ?? computeQuestionStatus(question.correct_answer, question.user_answer, question.options);
    totalMarks += Number(question.metadata?.totalMarks ?? correctMarks) || correctMarks;

    if (status === 'correct') {
      correct += 1;
      scoredMarks += Number(question.marks_awarded ?? question.metadata?.correctMarks ?? correctMarks) || correctMarks;
    } else if (status === 'incorrect') {
      incorrect += 1;
      scoredMarks -= Math.abs(Number(question.negative_marks ?? question.metadata?.negativeMarks ?? negativeMarks) || 0);
    } else if (status === 'skipped' || status === 'unattempted') {
      skipped += 1;
    } else {
      unknown += 1;
    }
  }

  return { scoredMarks, totalMarks, correct, incorrect, skipped, unknown };
}
