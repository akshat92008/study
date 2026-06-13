import { createHash } from 'node:crypto';

export interface RecentPracticeRecord {
  conceptId?: string | null;
  questionText?: string | null;
  answeredAt?: string | null;
  outcome?: 'correct' | 'incorrect' | 'partial' | null;
  spacedRecallDue?: boolean;
}

export function practiceQuestionHash(questionText: string): string {
  return createHash('sha256').update(questionText.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex').slice(0, 20);
}

export function mayAskPracticeQuestion(input: {
  conceptId?: string | null;
  questionText: string;
  recent: RecentPracticeRecord[];
}): { allowed: boolean; spacedRecall: boolean; reason?: string } {
  const questionHash = practiceQuestionHash(input.questionText);
  const identical = input.recent.find((record) => record.questionText && practiceQuestionHash(record.questionText) === questionHash);
  if (identical) return { allowed: false, spacedRecall: false, reason: 'identical_question_recently_asked' };

  const sameConcept = input.recent.find((record) => record.conceptId && record.conceptId === input.conceptId);
  if (!sameConcept) return { allowed: true, spacedRecall: false };
  if (sameConcept.spacedRecallDue) return { allowed: true, spacedRecall: true };
  if (sameConcept.outcome === 'correct') return { allowed: false, spacedRecall: false, reason: 'concept_already_answered_correctly' };
  return { allowed: true, spacedRecall: false, reason: 'use_different_angle_after_explanation' };
}
