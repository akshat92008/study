import type { AssessmentQuestionRecord, MistakeDiagnosisRecord, MistakeType, Severity } from './types';

export interface DeterministicClassificationInput {
  userId: string;
  assessmentId?: string | null;
  question?: AssessmentQuestionRecord | null;
  goalId?: string | null;
  userReason?: string | null;
  userReasonCategory?: string | null;
}

const CATEGORY_MAP: Record<string, MistakeType> = {
  concept: 'concept_gap',
  concept_gap: 'concept_gap',
  did_not_know: 'concept_gap',
  unknown_concept: 'concept_gap',
  forgot: 'memory_gap',
  memory: 'memory_gap',
  memory_gap: 'memory_gap',
  formula: 'memory_gap',
  silly: 'silly_error',
  careless: 'silly_error',
  silly_error: 'silly_error',
  calculation: 'calculation_error',
  calculation_error: 'calculation_error',
  misread: 'misread_question',
  misread_question: 'misread_question',
  confused_options: 'poor_elimination',
  poor_elimination: 'poor_elimination',
  time: 'time_pressure',
  time_pressure: 'time_pressure',
  guessed: 'guessed',
  guess: 'guessed',
  application: 'weak_application',
  weak_application: 'weak_application',
  overthinking: 'overthinking',
  revision: 'lack_of_revision',
  lack_of_revision: 'lack_of_revision',
};

export function classifyMistakeDeterministically(input: DeterministicClassificationInput): MistakeDiagnosisRecord {
  try {
    const category = normalizeReasonCategory(input.userReasonCategory);
    const reason = `${input.userReasonCategory ?? ''} ${input.userReason ?? ''}`.toLowerCase();
    const mistakeType = CATEGORY_MAP[category] ?? inferMistakeType(reason);
    const severity = severityFor(input.question, mistakeType);
    const rootCause = rootCauseFor(mistakeType, input.question?.topic, input.userReason);

    return {
      user_id: input.userId,
      assessment_id: input.assessmentId ?? input.question?.assessment_id ?? null,
      question_id: input.question?.id ?? null,
      goal_id: input.goalId ?? null,
      subject: input.question?.subject ?? null,
      topic: input.question?.topic ?? input.question?.subtopic ?? null,
      mistake_type: mistakeType,
      user_reason: input.userReason ?? null,
      user_reason_category: input.userReasonCategory ?? null,
      final_root_cause: rootCause,
      prevention_rule: preventionRuleFor(mistakeType),
      fix_strategy: fixStrategyFor(mistakeType, input.question?.topic),
      severity,
      confidence: mistakeType === 'unknown' ? 0.45 : 0.78,
      status: 'ready',
      evidence: {
        deterministic: true,
        questionStatus: input.question?.status ?? 'unknown',
        answerPattern: {
          correctAnswer: input.question?.correct_answer ?? null,
          userAnswer: input.question?.user_answer ?? null,
        },
      },
    };
  } catch {
    return {
      user_id: input.userId,
      assessment_id: input.assessmentId ?? null,
      question_id: input.question?.id ?? null,
      goal_id: input.goalId ?? null,
      subject: input.question?.subject ?? null,
      topic: input.question?.topic ?? null,
      mistake_type: 'unknown',
      user_reason: input.userReason ?? null,
      user_reason_category: input.userReasonCategory ?? null,
      final_root_cause: 'The mistake could not be classified reliably yet.',
      prevention_rule: 'Review the question once and add a clearer reason before retrying.',
      fix_strategy: 'Mark this item for manual review.',
      severity: 'medium',
      confidence: 0.4,
      status: 'fallback_used',
      evidence: { deterministic: true, fallback: true },
    };
  }
}

function normalizeReasonCategory(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function inferMistakeType(reason: string): MistakeType {
  if (/\b(concept|did not know|don't know|unclear|new)\b/.test(reason)) return 'concept_gap';
  if (/\b(forgot|formula|fact|remember|memory)\b/.test(reason)) return 'memory_gap';
  if (/\b(silly|careless|minor|bubble|marking)\b/.test(reason)) return 'silly_error';
  if (/\b(calc|calculation|arithmetic|sign|unit)\b/.test(reason)) return 'calculation_error';
  if (/\b(misread|read|word|except|not|statement)\b/.test(reason)) return 'misread_question';
  if (/\b(time|rushed|panic|ran out)\b/.test(reason)) return 'time_pressure';
  if (/\b(confus|option|elimination|between)\b/.test(reason)) return 'poor_elimination';
  if (/\b(guess|guessed)\b/.test(reason)) return 'guessed';
  if (/\b(apply|application|twist)\b/.test(reason)) return 'weak_application';
  if (/\b(overthink|second guess)\b/.test(reason)) return 'overthinking';
  if (/\b(revision|revised|practice)\b/.test(reason)) return 'lack_of_revision';
  return 'unknown';
}

function severityFor(question: AssessmentQuestionRecord | null | undefined, mistakeType: MistakeType): Severity {
  if (mistakeType === 'concept_gap' || mistakeType === 'time_pressure') return 'high';
  if (question?.difficulty === 'hard' && mistakeType !== 'silly_error') return 'high';
  if (mistakeType === 'unknown' || mistakeType === 'guessed') return 'medium';
  return 'medium';
}

function rootCauseFor(mistakeType: MistakeType, topic?: string | null, userReason?: string | null): string {
  const where = topic ? ` in ${topic}` : '';
  if (userReason?.trim()) return userReason.trim().slice(0, 240);

  switch (mistakeType) {
    case 'concept_gap': return `The underlying concept${where} is not stable enough yet.`;
    case 'memory_gap': return `The fact, formula, or recall cue${where} was not retrieved quickly.`;
    case 'silly_error': return 'The method was likely known, but execution discipline slipped.';
    case 'calculation_error': return 'The setup may be right, but arithmetic, signs, or units caused loss.';
    case 'misread_question': return 'The question wording or constraint was not checked carefully enough.';
    case 'time_pressure': return 'Speed pressure reduced accuracy and review time.';
    case 'poor_elimination': return 'Option comparison was not decisive enough.';
    case 'guessed': return 'The answer was selected without enough evidence.';
    case 'weak_application': return `The concept${where} did not transfer cleanly to this question style.`;
    case 'overthinking': return 'The first sound route was abandoned or complicated unnecessarily.';
    case 'lack_of_revision': return `Recent revision${where} was not strong enough before attempting.`;
    default: return 'The exact cause is not clear yet.';
  }
}

function preventionRuleFor(mistakeType: MistakeType): string {
  switch (mistakeType) {
    case 'concept_gap': return 'Before retrying, explain the rule aloud and solve one easier prerequisite question.';
    case 'memory_gap': return 'Write the formula or fact from memory before looking at options.';
    case 'silly_error': return 'Pause for a five-second final check before marking the answer.';
    case 'calculation_error': return 'Track signs, units, and substitutions line by line.';
    case 'misread_question': return 'Underline the demand word and any NOT/EXCEPT constraint before solving.';
    case 'time_pressure': return 'Skip sooner, return later, and protect review time.';
    case 'poor_elimination': return 'Eliminate options with a written reason instead of intuition only.';
    case 'guessed': return 'Mark guesses explicitly and review the concept before attempting similar questions.';
    case 'weak_application': return 'Solve two variant questions after reviewing the core concept.';
    case 'overthinking': return 'Choose the simplest valid route and only switch if you find a concrete contradiction.';
    case 'lack_of_revision': return 'Schedule a short recall review before new practice.';
    default: return 'Add a clearer reason and retry this question after review.';
  }
}

function fixStrategyFor(mistakeType: MistakeType, topic?: string | null): string {
  const target = topic ? ` for ${topic}` : '';
  switch (mistakeType) {
    case 'concept_gap': return `Rebuild the concept ladder${target}: definition, example, then two applications.`;
    case 'memory_gap': return `Create recall cards${target} and review them before practice.`;
    case 'silly_error': return 'Use a written final-check routine on the next 10 questions.';
    case 'calculation_error': return 'Redo the calculation slowly, then repeat under time pressure.';
    case 'time_pressure': return 'Practice a timed set with aggressive skip rules.';
    default: return `Review the question pattern${target} and retry after one corrective example.`;
  }
}
