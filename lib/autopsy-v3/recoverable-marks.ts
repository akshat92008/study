import type {
  AssessmentQuestionRecord,
  AssessmentRecord,
  MistakeDiagnosisRecord,
  MistakeType,
  RecoverableMarksEstimate,
} from './types';

const RECOVERABILITY: Record<MistakeType, { immediate: number; short: number; long: number }> = {
  silly_error: { immediate: 0.75, short: 0.2, long: 0.05 },
  misread_question: { immediate: 0.7, short: 0.25, long: 0.05 },
  calculation_error: { immediate: 0.4, short: 0.45, long: 0.15 },
  memory_gap: { immediate: 0.2, short: 0.55, long: 0.25 },
  time_pressure: { immediate: 0.25, short: 0.55, long: 0.2 },
  concept_gap: { immediate: 0.08, short: 0.37, long: 0.55 },
  guessed: { immediate: 0.05, short: 0.25, long: 0.7 },
  poor_elimination: { immediate: 0.25, short: 0.45, long: 0.3 },
  weak_application: { immediate: 0.12, short: 0.42, long: 0.46 },
  overthinking: { immediate: 0.45, short: 0.4, long: 0.15 },
  lack_of_revision: { immediate: 0.2, short: 0.6, long: 0.2 },
  unknown: { immediate: 0.1, short: 0.3, long: 0.6 },
};

export function estimateRecoverableMarks(
  _assessment: AssessmentRecord,
  questions: AssessmentQuestionRecord[],
  diagnoses: MistakeDiagnosisRecord[]
): RecoverableMarksEstimate {
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  let immediately = 0;
  let shortTerm = 0;
  let longTerm = 0;

  for (const diagnosis of diagnoses) {
    const question = diagnosis.question_id ? questionsById.get(diagnosis.question_id) : null;
    const marks = marksLostFor(question);
    const weights = RECOVERABILITY[diagnosis.mistake_type] ?? RECOVERABILITY.unknown;
    immediately += marks * weights.immediate;
    shortTerm += marks * weights.short;
    longTerm += marks * weights.long;
  }

  const round = (value: number) => Math.round(value * 10) / 10;
  const immediateRounded = round(immediately);
  const shortRounded = round(shortTerm);
  const longRounded = round(longTerm);

  return {
    immediately_recoverable: immediateRounded,
    short_term_recoverable: shortRounded,
    long_term_recoverable: longRounded,
    explanation: [
      `${immediateRounded} marks look immediately recoverable through reading and execution checks.`,
      `${shortRounded} marks need a short recall or timed-practice cycle.`,
      `${longRounded} marks are longer-term concept/application rebuild work.`,
    ].join(' '),
  };
}

export function marksLostFor(question?: AssessmentQuestionRecord | null): number {
  if (!question) return 1;
  const metadata = question.metadata ?? {};
  const total = Number(metadata.totalMarks ?? metadata.correctMarks ?? 1);
  const awarded = Number(question.marks_awarded ?? 0);
  if (question.status === 'correct') return 0;
  if (Number.isFinite(total) && total > 0) return Math.max(0, total - Math.max(0, awarded));
  return 1;
}
