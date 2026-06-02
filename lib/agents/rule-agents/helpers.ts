import type { LearningEvent } from '@/lib/agents/cheap-types';

export type EvidenceItem = {
  sourceId?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  conceptId?: string | null;
  conceptName?: string | null;
  isCorrect?: boolean | null;
  timeTakenSeconds?: number | null;
  selectedAnswer?: string | null;
  correctAnswer?: string | null;
  questionId?: string | null;
  score?: number | null;
  raw: Record<string, unknown>;
};

export function evidenceItems(event: LearningEvent): EvidenceItem[] {
  const payload = event.payload ?? {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length > 0) {
    return items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, index) => normalizeItem(event, item, index));
  }

  return [normalizeItem(event, payload, 0)];
}

export function normalizeTopic(item: EvidenceItem) {
  return {
    subject: stringOrNull(item.subject),
    chapter: stringOrNull(item.chapter),
    topic: stringOrNull(item.topic ?? item.conceptName),
  };
}

export function isLearningSignal(event: LearningEvent) {
  return [
    'PRACTICE_ATTEMPT_RECORDED',
    'PRACTICE_ATTEMPT_SUBMITTED',
    'MOCK_TEST_ANALYZED',
    'MOCK_TEST_UPLOADED',
    'AUTOPSY_MOCK_PROCESSED',
    'AUTOPSY_MISTAKE_APPROVED',
    'REVISION_COMPLETED',
    'REVISION_CARD_REVIEWED',
    'MATERIAL_UPLOADED',
    'MATERIAL_INGESTED',
    'CHAT_MESSAGE_CREATED',
    'CHAT_MESSAGE_PROCESSED',
    'CHAT_LEARNING_SIGNAL',
    'TEST_ANALYSIS_COMPLETED',
    'MIND_TUTOR_COMPLETED',
    'STUDY_SESSION_COMPLETED',
  ].includes(event.type);
}

export function wrongItems(event: LearningEvent) {
  return evidenceItems(event).filter((item) => item.isCorrect === false);
}

export function correctItems(event: LearningEvent) {
  return evidenceItems(event).filter((item) => item.isCorrect === true);
}

export function sourceTypeForEvent(event: LearningEvent) {
  if (event.type.includes('PRACTICE')) return 'practice_attempt';
  if (event.type.includes('AUTOPSY') || event.type.includes('MOCK') || event.type.includes('TEST')) return 'mock_test';
  if (event.type.includes('REVISION')) return 'revision';
  if (event.type.includes('MATERIAL')) return 'material';
  if (event.type.includes('CHAT') || event.type.includes('MIND')) return 'chat';
  return event.type.toLowerCase();
}

export function idPart(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function scoreForItem(item: EvidenceItem) {
  if (typeof item.score === 'number' && Number.isFinite(item.score)) {
    return clamp(item.score, 0, 1);
  }
  if (item.isCorrect === true) return 1;
  if (item.isCorrect === false) return 0;
  return null;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeItem(event: LearningEvent, item: Record<string, unknown>, index: number): EvidenceItem {
  const payload = event.payload ?? {};
  const conceptName = stringOrNull(item.conceptName ?? item.concept_name ?? item.topic ?? payload.topic);
  return {
    sourceId: stringOrNull(item.attemptId ?? item.attempt_id ?? item.id ?? payload.sourceId ?? payload.practiceSetId ?? event.id),
    subject: stringOrNull(item.subject ?? payload.subject),
    chapter: stringOrNull(item.chapter ?? payload.chapter ?? payload.topic),
    topic: stringOrNull(item.topic ?? item.conceptName ?? item.concept_name ?? payload.topic ?? payload.detectedTopic),
    conceptId: stringOrNull(item.conceptId ?? item.concept_id),
    conceptName,
    isCorrect: booleanOrNull(item.isCorrect ?? item.is_correct ?? item.correct),
    timeTakenSeconds: numberOrNull(item.timeTakenSeconds ?? item.time_taken_seconds),
    selectedAnswer: stringOrNull(item.selectedAnswer ?? item.answer ?? item.selected_answer),
    correctAnswer: stringOrNull(item.correctAnswer ?? item.correct_answer),
    questionId: stringOrNull(item.questionId ?? item.question_id ?? item.practiceItemId ?? item.practice_item_id),
    score: numberOrNull(item.score),
    raw: { ...payload, ...item, itemIndex: index },
  };
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function booleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
}
