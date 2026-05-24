import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';
import { ConversationTurn } from '@/lib/types/conversation';
import { LLMMessage } from '@/lib/ai/providers/LLMProvider';
import { GeminiProvider } from '@/lib/ai/providers/GeminiProvider';

/**
 * Utility to count approximate tokens in a string. Very rough estimate: 1 token ≈ 4 characters.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Retrieve raw conversation memory for a user.
 * This stub assumes a Supabase table `conversation_memory` with columns:
 *   - id (uuid)
 *   - user_id (uuid)
 *   - role ('user'|'model'|'system')
 *   - content (text)
 *   - metadata (jsonb) optional
 *   - created_at (timestamp)
 */
export async function fetchConversationTurns(userId: string): Promise<ConversationTurn[]> {
  const supabase = await createClient();

  // ✅ FIX: Read from chat_messages (the real table) not conversation_memory (doesn't exist)
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(100); // Last 100 messages is plenty for context

  if (error) {
    logger.error('Failed to fetch conversation turns', { error, userId });
    return [];
  }

  return (data || []).map((row: any) => ({
    role: row.role === 'assistant' ? 'model' : row.role, // Gemini uses 'model' not 'assistant'
    content: row.content,
    metadata: row.metadata ?? {},
    timestamp: row.created_at,
  }));
}

/**
 * Ranking logic for conversation turns.
 * Scoring components (default weights) can be tuned via the `weights` argument.
 */
export function rankTurns(
  turns: ConversationTurn[],
  weights?: { recency?: number; emotional?: number; mastery?: number },
): ConversationTurn[] {
  const w = { recency: 0.6, emotional: 0.2, mastery: 0.2, ...weights };
  const now = Date.now();

  const scored = turns.map((turn) => {
    const ageMs = now - new Date(turn.timestamp).getTime();
    // Recency: linear decay over 14 days (tighter than 30 days — students study fast)
    const recencyScore = Math.max(0, 1 - ageMs / (1000 * 60 * 60 * 24 * 14));
    // Emotional: flag turns where the student expressed struggle or success
    const emotionalKeywords = ['wrong', 'confused', 'stuck', 'got it', 'understand', 'correct', 'nailed'];
    const hasEmotionalSignal = emotionalKeywords.some((kw) =>
      turn.content.toLowerCase().includes(kw)
    );
    const emotionalScore = hasEmotionalSignal ? 1 : 0;
    // Mastery: turns referencing concepts are more valuable context
    const masteryScore = turn.metadata?.conceptRefs
      ? Math.min(turn.metadata.conceptRefs.length / 5, 1)
      : 0;

    const total =
      recencyScore * w.recency +
      emotionalScore * w.emotional +
      masteryScore * w.mastery;

    return { turn, score: total };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.turn);
}

/**
 * Produce a rolling summary for older turns using Gemini.
 * The `windowSize` determines how many recent turns are kept verbatim.
 */
export async function rollingSummarize(
  turns: ConversationTurn[],
  windowSize: number = 6
): Promise<{ summary: string; recentTurns: ConversationTurn[] }> {
  if (turns.length <= windowSize) {
    return { summary: '', recentTurns: turns };
  }

  const recentTurns = turns.slice(-windowSize);
  const olderTurns = turns.slice(0, -windowSize);

  const olderText = olderTurns
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join('\n');

  const prompt = `Summarize the following conversation history concisely, preserving important concepts, emotional tone, and any learner metadata. Return a short paragraph (max 150 words).\n\n${olderText}`;
  const summary = (await generateJSON('flash', 'You are a concise summarizer.', prompt)) as string;

  return { summary, recentTurns };
}

/**
 * Token‑aware compression – ensure the final prompt fits within `maxTokens`.
 * Older content is replaced by the rolling summary when needed.
 */
export async function compressForPrompt(
  turns: ConversationTurn[],
  maxTokens: number = 12000
): Promise<LLMMessage[]> {
  // Convert turns to LLMMessage format.
  const messages: LLMMessage[] = [];
  for (const turn of turns) {
    messages.push({
      role: turn.role as any,
      content: turn.content,
    });
  }

  let totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);

  if (totalTokens <= maxTokens) {
    return messages;
  }

  // Apply rolling summarization until within limit.
  let window = 6;
  let summary = '';
  let recent = messages;
  while (totalTokens > maxTokens && window > 0) {
    // Convert turns to LLMMessage for summarization (placeholder, not used directly)
    const turnObjs = turns.map((t) => ({ role: t.role as any, content: t.content } as LLMMessage));
    const { summary: sumText, recentTurns } = await rollingSummarize(turns, window);
    summary = sumText;
    recent = recentTurns.map((t) => ({ role: t.role as any, content: t.content } as LLMMessage));
    totalTokens = estimateTokens(summary) + recent.reduce((s, m) => s + estimateTokens(m.content || ''), 0);
    window -= 2; // shrink recent window if still too large
  }

  const final: LLMMessage[] = [];
  if (summary) {
    final.push({ role: 'system', content: `Conversation Summary: ${summary}` });
  }
  final.push(...recent);
  return final;
}

/**
 * Assemble the final prompt for Gemini (or compatible LLM).
 */
export async function assemblePrompt(
  userId: string,
  userMessage: string,
  maxTokens: number = 12000
): Promise<LLMMessage[]> {
  const allTurns = await fetchConversationTurns(userId);
  const ranked = rankTurns(allTurns, undefined);
  // Append the new user message as the latest turn.
  ranked.push({ role: 'user', content: userMessage, metadata: {}, timestamp: new Date().toISOString() });
  const compressed = await compressForPrompt(ranked, maxTokens);
  return compressed;
}

/**
 * Stream response from Gemini while emitting event hooks.
 * This is a thin wrapper; actual streaming implementation depends on the Gemini client used.
 */
export async function* streamGeminiResponse(
  userId: string,
  userMessage: string
): AsyncGenerator<string, void, unknown> {
  const prompt = await assemblePrompt(userId, userMessage);
  const provider = new GeminiProvider();
  // Stream response using provider
  for await (const chunk of provider.stream(prompt)) {
    yield chunk;
  }
}
