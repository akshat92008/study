import type { AssessmentType, MemoryType, MistakeType, QuestionStatus, Severity } from './types';

export const ASSESSMENT_TYPES: AssessmentType[] = [
  'mock_test',
  'practice_test',
  'worksheet',
  'assignment',
  'quiz',
  'past_paper',
  'custom',
];

export const QUESTION_STATUSES: QuestionStatus[] = [
  'correct',
  'incorrect',
  'skipped',
  'unattempted',
  'unknown',
];

export const MISTAKE_TYPES: MistakeType[] = [
  'concept_gap',
  'memory_gap',
  'silly_error',
  'calculation_error',
  'misread_question',
  'time_pressure',
  'poor_elimination',
  'guessed',
  'weak_application',
  'overthinking',
  'lack_of_revision',
  'unknown',
];

export const MEMORY_TYPES: MemoryType[] = [
  'mistake_pattern',
  'weak_topic',
  'behavior_pattern',
  'prevention_rule',
  'recovery_progress',
  'confusion_signal',
  'self_reported_weakness',
  'time_pressure_pattern',
  'confidence_mismatch',
];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const MISTAKE_TYPE_LABELS: Record<MistakeType, string> = {
  concept_gap: 'Concept gap',
  memory_gap: 'Memory gap',
  silly_error: 'Silly error',
  calculation_error: 'Calculation error',
  misread_question: 'Misread question',
  time_pressure: 'Time pressure',
  poor_elimination: 'Poor elimination',
  guessed: 'Guessed',
  weak_application: 'Weak application',
  overthinking: 'Overthinking',
  lack_of_revision: 'Lack of revision',
  unknown: 'Unknown',
};

export const DEFAULT_CORRECT_MARKS = 1;
export const DEFAULT_NEGATIVE_MARKS = 0;
