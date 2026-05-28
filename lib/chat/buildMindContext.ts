// lib/chat/buildMindContext.ts

import { ChatMemoryService } from '@/lib/services/chatMemoryService';
// Stubbed functions for missing engines
async function getLearnerProfile(userId: string) { return {}; }
async function getDueCards(userId: string) { return []; }
async function getWeakConcepts(userId: string) { return []; }
async function getRecentMistakes(userId: string) { return []; }
async function retrieveRelevantMemories(userId: string, latestMessage: string) { return []; }
function applyContextBudget(ctx: MindContext): MindContext { return ctx; }

export type MindContext = {
  learner: {
    exam?: string;
    deadline?: string;
    level?: string;
    preferredStyle?: string;
  };
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  dueCards: Array<{ id: string; front: string; conceptId?: string }>;
  weakConcepts: Array<{ id: string; name: string; mastery: string; reason: string }>;
  recentMistakes: Array<{ conceptName: string; category: string; lesson: string }>;
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

/**
 * Assemble a MindContext for a given user and latest user message.
 * This pulls data from various services and applies the context budgeter.
 */
export async function buildMindContext(userId: string, latestMessage: string): Promise<MindContext> {
  // Learner profile (exam, deadline, etc.)
  const learner = await getLearnerProfile(userId);

  // Recent chat messages (including the latest user message)
  const memoryService = new ChatMemoryService();
  const recentMessagesStrings = await memoryService.searchMemory(userId, '', 20); // fallback for now
  const recentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = recentMessagesStrings.map(content => ({ role: 'user', content }));
  const enrichedMessages = [...recentMessages, { role: 'user' as const, content: latestMessage }];

  // Due flashcards, weak concepts, recent mistakes
  const [dueCards, weakConcepts, recentMistakes] = await Promise.all([
    getDueCards(userId),
    getWeakConcepts(userId),
    getRecentMistakes(userId),
  ]);

  // Retrieve semantic memories relevant to the latest message
  const retrievedMemories = await retrieveRelevantMemories(userId, latestMessage);

  let ctx: MindContext = {
    learner,
    recentMessages: enrichedMessages,
    dueCards,
    weakConcepts,
    recentMistakes,
    retrievedMemories,
  };

  // Apply token budget (e.g., max 4000 tokens). The budgeter will trim recentMessages.
  ctx = applyContextBudget(ctx);

  return ctx;
}
