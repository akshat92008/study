// Compatibility wrapper around the canonical MIND context builder.
// New code should import getMINDContext from '@/lib/engines/mind-engine'.

import { getMINDContext } from '@/lib/engines/mind-engine';

export type MindContext = {
  learner: {
    exam?: string;
    emotionalState?: string;
  };
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  dueCards: Array<{ id: string; front: string; conceptId?: string }>;
  weakConcepts: Array<{ id?: string; name: string; mastery: string; reason: string }>;
  recentMistakes: Array<any>;
  retrievedMemories: Array<{ text: string; score: number }>;
};

export function renderMindContext(ctx: MindContext): string {
  return [
    `Learner: ${JSON.stringify(ctx.learner)}`,
    `Weak concepts: ${JSON.stringify(ctx.weakConcepts)}`,
    `Due cards: ${JSON.stringify(ctx.dueCards)}`,
    `Recent mistakes: ${JSON.stringify(ctx.recentMistakes)}`,
    `Relevant memories: ${JSON.stringify(ctx.retrievedMemories)}`,
  ].join('\n\n');
}

export async function buildMindContext(userId: string, latestMessage: string): Promise<MindContext> {
  const ctx = await getMINDContext(userId, latestMessage);

  return {
    learner: {
      exam: ctx.profile.examType,
      emotionalState: ctx.emotionalState,
    },
    recentMessages: [],
    dueCards: (ctx.topOverdueCards || []).map((card: any) => ({
      id: card.id,
      front: card.front,
      conceptId: card.concept_id,
    })),
    weakConcepts: (ctx.weakConcepts || []).map((concept: any) => ({
      id: concept.id,
      name: concept.name,
      mastery: concept.mastery,
      reason: 'Canonical MIND learner-state weak concept',
    })),
    recentMistakes: ctx.recentMistakes || [],
    retrievedMemories: [
      ...(ctx.ragChunks || []).map((chunk: any) => ({
        text: chunk.content,
        score: chunk.similarity ?? 1,
      })),
    ],
  };
}
