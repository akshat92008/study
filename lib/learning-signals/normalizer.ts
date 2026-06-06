import type { LearningSignalInput, NormalizedLearningSignal } from './types';

const SIGNAL_TYPES = new Set([
  'assessment_result',
  'question_mistake',
  'manual_mistake',
  'chat_confusion',
  'revision_review',
  'practice_attempt',
  'practice_requested',
  'confusion_detected',
  'concept_practiced',
  'doubt_asked',
  'source_upload',
  'self_reflection',
  'task_completion',
  'autopsy_memory_created',
]);

export function normalizeLearningSignal(input: LearningSignalInput): NormalizedLearningSignal {
  if (!SIGNAL_TYPES.has(input.signal_type)) {
    throw new Error(`Unsupported learning signal type: ${input.signal_type}`);
  }

  return {
    user_id: input.user_id,
    goal_id: input.goal_id ?? null,
    signal_type: input.signal_type,
    source_type: (input.source_type || input.signal_type).slice(0, 80),
    source_id: input.source_id ?? null,
    subject: cleanOptional(input.subject),
    topic: cleanOptional(input.topic),
    confidence: clamp(input.confidence ?? 0.5),
    evidence: sanitizeEvidence(input.evidence ?? {}),
    idempotency_key: input.idempotency_key ?? null,
    created_at: input.created_at,
  };
}

function cleanOptional(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 160) : null;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function sanitizeEvidence(value: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(value);
  if (json.length <= 8000) return value;
  return {
    truncated: true,
    preview: json.slice(0, 4000),
  };
}
