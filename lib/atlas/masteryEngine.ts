import type { LearningSignal } from '@/lib/agent/types';
import { guardedNewMasteryScore, statusFromScore } from '@/lib/agent/guardrails/masteryGuard';

export function computeMasteryUpdate(input: {
  previousScore: number;
  previousStatus?: string | null;
  signal: LearningSignal;
}) {
  const previousScore = Number.isFinite(input.previousScore) ? input.previousScore : 0;
  const newScore = guardedNewMasteryScore(previousScore, input.signal);
  const newStatus = statusFromScore(newScore);
  return {
    previousScore,
    previousStatus: input.previousStatus ?? statusFromScore(previousScore),
    newScore,
    newStatus,
    changed: newScore !== previousScore || newStatus !== input.previousStatus,
  };
}

