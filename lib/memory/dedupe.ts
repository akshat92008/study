import { normalizeMemoryKey } from '@/lib/agent/guardrails/duplicateMemoryGuard';

export function memoryCardKey(input: { userId: string; conceptId: string; source?: string | null }) {
  return normalizeMemoryKey(`agent-memory:${input.userId}:${input.conceptId}:${input.source ?? 'learning-signal'}`);
}

