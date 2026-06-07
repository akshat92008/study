import type { AgentContextSummary } from '@/lib/agent/types';

export function summarizeAtlasProjection(context: AgentContextSummary) {
  const atlas = context.atlas ?? {};
  const weak = Array.isArray((atlas as any).weakConcepts) ? (atlas as any).weakConcepts : [];
  const learning = Array.isArray((atlas as any).learningConcepts) ? (atlas as any).learningConcepts : [];
  return {
    weakCount: weak.length,
    learningCount: learning.length,
    topWeakConcepts: weak.slice(0, 5).map((row: any) => row.name ?? row.topic ?? row.concept).filter(Boolean),
  };
}

