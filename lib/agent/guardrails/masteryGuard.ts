import type { LearningSignal } from '@/lib/agent/types';

export type MasteryStatus = 'weak' | 'learning' | 'strong' | 'ready' | 'not_started';

export function clampMasteryScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function statusFromScore(score: number): MasteryStatus {
  if (score <= 0) return 'not_started';
  if (score < 30) return 'weak';
  if (score < 65) return 'learning';
  if (score < 85) return 'strong';
  return 'ready';
}

export function masteryDeltaForSignal(signal: LearningSignal): number {
  switch (signal.type) {
    case 'misconception_detected':
      return -16;
    case 'weak_area_detected':
      return -10;
    case 'practice_needed':
    case 'revision_needed':
      return -6;
    case 'practice_attempt_submitted':
      return signal.correct ? 8 : -12;
    case 'revision_reviewed':
      return signal.correct ? 6 : -8;
    case 'concept_understood':
      return 4;
    case 'explanation_generated':
      return 1;
    default:
      return 0;
  }
}

export function guardedNewMasteryScore(previous: number, signal: LearningSignal) {
  const delta = masteryDeltaForSignal(signal);
  let next = previous + delta;

  if (signal.type === 'concept_understood') {
    next = Math.min(next, 64);
  }
  if (signal.type === 'explanation_generated') {
    next = Math.min(next, 45);
  }
  if (signal.type === 'weak_area_detected' || signal.type === 'misconception_detected') {
    next = Math.min(next, 29);
    if (previous <= 0) next = signal.type === 'misconception_detected' ? 10 : 18;
  }

  return clampMasteryScore(next);
}

