// lib/chat/buildMindContext.ts

import { ChatMemoryService } from '@/lib/services/chatMemoryService';
import { createClient } from '@/lib/supabase/server';

async function getLearnerProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('exam_type, emotional_state').eq('id', userId).maybeSingle();
  return { exam: data?.exam_type || 'General', emotionalState: data?.emotional_state || 'neutral' };
}

async function getDueCards(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('revision_cards')
    .select('id, front, concept_id')
    .eq('user_id', userId)
    .lte('due', new Date().toISOString())
    .limit(5);
  return (data || []).map(card => ({
    id: card.id,
    front: card.front,
    conceptId: card.concept_id || undefined,
  }));
}

async function getWeakConcepts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('concepts')
    .select('id, name, mastery, subject')
    .eq('user_id', userId)
    .in('mastery', ['exposed', 'developing'])
    .order('forgetting_probability', { ascending: false })
    .limit(5);
  return (data || []).map(c => ({ id: c.id, name: c.name, mastery: c.mastery, reason: 'High forgetting probability or developing status' }));
}

async function getRecentMistakes(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('mistakes')
    .select('concept_id, category, question_text, correct_answer, ai_analysis, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);
  return data || [];
}

async function retrieveRelevantMemories(userId: string, latestMessage: string) {
  const memoryService = new ChatMemoryService();
  const memories = await memoryService.searchMemory(userId, latestMessage, 5);
  return memories.map(m => ({ text: m, score: 1 }));
}

function applyContextBudget(ctx: MindContext): MindContext {
  // Trim recent messages if too long
  if (ctx.recentMessages.length > 10) {
    ctx.recentMessages = ctx.recentMessages.slice(-10);
  }
  return ctx;
}

export type MindContext = {
  learner: {
    exam?: string;
    emotionalState?: string;
  };
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  dueCards: Array<{ id: string; front: string; conceptId?: string }>;
  weakConcepts: Array<{ id: string; name: string; mastery: string; reason: string }>;
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
