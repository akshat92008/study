// lib/ai/token-budget.ts
// Per-task token budgets for every AI cost mode.
// This replaces the old single-limit MAX_PROMPT_CHARS approach with
// a task-aware, mode-aware budget system.
//
// Priority for enforceTokenBudget trimming:
//   1. Old messages (oldest first, never current user message)
//   2. RAG chunk blocks
//   3. Generated document blocks (most aggressive)
//   4. System prompt (partial, preserve first 800 chars)
//   5. Current user message (partial, absolute last resort)

import { logger } from '@/lib/utils/logger';
import { getAiCostMode, type AiCostMode } from './cost-mode';
import { isUnlimitedUser } from '@/lib/auth/admin';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type AiTask =
  | 'chat'
  | 'tutor'
  | 'stream'
  | 'json'
  | 'classification'
  | 'vision'
  | 'embedding'
  | 'pdf'
  | 'autopsy'
  | 'document_generation'
  | 'flashcards'
  | 'formula_sheet';

export type CompressionMode = 'none' | 'light' | 'aggressive' | 'summary_only';

export type TokenBudget = {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxRecentMessages: number;
  maxRagChunks: number;
  maxChunkChars: number;
  compressionMode: CompressionMode;
};

export type LLMMessage = { role: string; content: string };

// ─── BUDGET TABLES ────────────────────────────────────────────────────────────

const ULTRA_CHEAP_BUDGETS: Record<AiTask, TokenBudget> = {
  chat:                { maxInputTokens: 2200,  maxOutputTokens: 450,  maxRecentMessages: 3,  maxRagChunks: 1, maxChunkChars: 900,  compressionMode: 'aggressive' },
  tutor:               { maxInputTokens: 2600,  maxOutputTokens: 600,  maxRecentMessages: 4,  maxRagChunks: 1, maxChunkChars: 1000, compressionMode: 'aggressive' },
  stream:              { maxInputTokens: 2200,  maxOutputTokens: 450,  maxRecentMessages: 3,  maxRagChunks: 1, maxChunkChars: 900,  compressionMode: 'aggressive' },
  json:                { maxInputTokens: 2200,  maxOutputTokens: 900,  maxRecentMessages: 1,  maxRagChunks: 1, maxChunkChars: 800,  compressionMode: 'aggressive' },
  classification:      { maxInputTokens: 600,   maxOutputTokens: 80,   maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'summary_only' },
  vision:              { maxInputTokens: 2000,  maxOutputTokens: 600,  maxRecentMessages: 1,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'light' },
  embedding:           { maxInputTokens: 700,   maxOutputTokens: 0,    maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 700,  compressionMode: 'none' },
  pdf:                 { maxInputTokens: 0,     maxOutputTokens: 0,    maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'summary_only' },
  autopsy:             { maxInputTokens: 3000,  maxOutputTokens: 900,  maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 1500, compressionMode: 'aggressive' },
  document_generation: { maxInputTokens: 2500,  maxOutputTokens: 1400, maxRecentMessages: 1,  maxRagChunks: 1, maxChunkChars: 1200, compressionMode: 'aggressive' },
  flashcards:          { maxInputTokens: 2500,  maxOutputTokens: 1200, maxRecentMessages: 1,  maxRagChunks: 1, maxChunkChars: 1000, compressionMode: 'aggressive' },
  formula_sheet:       { maxInputTokens: 2000,  maxOutputTokens: 1000, maxRecentMessages: 0,  maxRagChunks: 1, maxChunkChars: 1200, compressionMode: 'light' },
};

const CHEAP_BUDGETS: Record<AiTask, TokenBudget> = {
  chat:                { maxInputTokens: 3500,  maxOutputTokens: 700,  maxRecentMessages: 5,  maxRagChunks: 2, maxChunkChars: 1000, compressionMode: 'light' },
  tutor:               { maxInputTokens: 4500,  maxOutputTokens: 900,  maxRecentMessages: 5,  maxRagChunks: 2, maxChunkChars: 1200, compressionMode: 'light' },
  stream:              { maxInputTokens: 3500,  maxOutputTokens: 700,  maxRecentMessages: 5,  maxRagChunks: 2, maxChunkChars: 1000, compressionMode: 'light' },
  json:                { maxInputTokens: 3500,  maxOutputTokens: 1200, maxRecentMessages: 2,  maxRagChunks: 2, maxChunkChars: 1000, compressionMode: 'light' },
  classification:      { maxInputTokens: 900,   maxOutputTokens: 100,  maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'summary_only' },
  vision:              { maxInputTokens: 3000,  maxOutputTokens: 800,  maxRecentMessages: 2,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'light' },
  embedding:           { maxInputTokens: 1000,  maxOutputTokens: 0,    maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 1000, compressionMode: 'none' },
  pdf:                 { maxInputTokens: 0,     maxOutputTokens: 0,    maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'summary_only' },
  autopsy:             { maxInputTokens: 5000,  maxOutputTokens: 1200, maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 2000, compressionMode: 'light' },
  document_generation: { maxInputTokens: 4500,  maxOutputTokens: 1800, maxRecentMessages: 2,  maxRagChunks: 2, maxChunkChars: 1500, compressionMode: 'light' },
  flashcards:          { maxInputTokens: 4000,  maxOutputTokens: 1500, maxRecentMessages: 2,  maxRagChunks: 2, maxChunkChars: 1200, compressionMode: 'light' },
  formula_sheet:       { maxInputTokens: 3500,  maxOutputTokens: 1400, maxRecentMessages: 1,  maxRagChunks: 2, maxChunkChars: 1500, compressionMode: 'light' },
};

const BALANCED_BUDGETS: Record<AiTask, TokenBudget> = {
  chat:                { maxInputTokens: 6000,  maxOutputTokens: 1000, maxRecentMessages: 8,  maxRagChunks: 3, maxChunkChars: 1800, compressionMode: 'light' },
  tutor:               { maxInputTokens: 7000,  maxOutputTokens: 1200, maxRecentMessages: 8,  maxRagChunks: 3, maxChunkChars: 2000, compressionMode: 'light' },
  stream:              { maxInputTokens: 6000,  maxOutputTokens: 1000, maxRecentMessages: 8,  maxRagChunks: 3, maxChunkChars: 1800, compressionMode: 'light' },
  json:                { maxInputTokens: 6000,  maxOutputTokens: 1800, maxRecentMessages: 4,  maxRagChunks: 3, maxChunkChars: 1800, compressionMode: 'light' },
  classification:      { maxInputTokens: 1200,  maxOutputTokens: 150,  maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'none' },
  vision:              { maxInputTokens: 5000,  maxOutputTokens: 1200, maxRecentMessages: 3,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'none' },
  embedding:           { maxInputTokens: 1500,  maxOutputTokens: 0,    maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 1500, compressionMode: 'none' },
  pdf:                 { maxInputTokens: 4000,  maxOutputTokens: 1500, maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 4000, compressionMode: 'light' },
  autopsy:             { maxInputTokens: 8000,  maxOutputTokens: 2000, maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 3000, compressionMode: 'none' },
  document_generation: { maxInputTokens: 7000,  maxOutputTokens: 2500, maxRecentMessages: 4,  maxRagChunks: 3, maxChunkChars: 2000, compressionMode: 'none' },
  flashcards:          { maxInputTokens: 6000,  maxOutputTokens: 2000, maxRecentMessages: 3,  maxRagChunks: 3, maxChunkChars: 1800, compressionMode: 'none' },
  formula_sheet:       { maxInputTokens: 5000,  maxOutputTokens: 1800, maxRecentMessages: 2,  maxRagChunks: 3, maxChunkChars: 2000, compressionMode: 'none' },
};

const QUALITY_BUDGETS: Record<AiTask, TokenBudget> = {
  chat:                { maxInputTokens: 10000, maxOutputTokens: 1500, maxRecentMessages: 12, maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
  tutor:               { maxInputTokens: 12000, maxOutputTokens: 2000, maxRecentMessages: 12, maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
  stream:              { maxInputTokens: 10000, maxOutputTokens: 1500, maxRecentMessages: 12, maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
  json:                { maxInputTokens: 10000, maxOutputTokens: 3000, maxRecentMessages: 6,  maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
  classification:      { maxInputTokens: 2000,  maxOutputTokens: 200,  maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'none' },
  vision:              { maxInputTokens: 8000,  maxOutputTokens: 2000, maxRecentMessages: 4,  maxRagChunks: 0, maxChunkChars: 0,    compressionMode: 'none' },
  embedding:           { maxInputTokens: 2000,  maxOutputTokens: 0,    maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 2000, compressionMode: 'none' },
  pdf:                 { maxInputTokens: 12000, maxOutputTokens: 3000, maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 6000, compressionMode: 'none' },
  autopsy:             { maxInputTokens: 15000, maxOutputTokens: 3000, maxRecentMessages: 0,  maxRagChunks: 0, maxChunkChars: 5000, compressionMode: 'none' },
  document_generation: { maxInputTokens: 12000, maxOutputTokens: 4000, maxRecentMessages: 6,  maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
  flashcards:          { maxInputTokens: 10000, maxOutputTokens: 3000, maxRecentMessages: 4,  maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
  formula_sheet:       { maxInputTokens: 8000,  maxOutputTokens: 2500, maxRecentMessages: 3,  maxRagChunks: 4, maxChunkChars: 2500, compressionMode: 'none' },
};

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Get the token budget for a task, optionally overriding the global cost mode.
 */
export function getTokenBudget(task: AiTask, mode?: AiCostMode): TokenBudget {
  const costMode = mode ?? getAiCostMode();
  switch (costMode) {
    case 'ultra_cheap': return ULTRA_CHEAP_BUDGETS[task];
    case 'cheap':       return CHEAP_BUDGETS[task];
    case 'balanced':    return BALANCED_BUDGETS[task];
    case 'quality':     return QUALITY_BUDGETS[task];
  }
}

/**
 * Rough token estimator: 1 token ≈ 4 characters.
 * Use for pre-call budget checks, not billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil((text ?? '').length / 4);
}

// ─── PROMPT PART TYPES ────────────────────────────────────────────────────────

export type PromptPartRole =
  | 'system'
  | 'user_current'   // the current (most recent) user message — never trimmed
  | 'user_history'   // older user messages
  | 'assistant'      // assistant messages
  | 'rag_chunk'      // retrieved RAG context
  | 'generated_doc'  // generated MCQ/flashcard/formula blocks
  | 'session_summary'; // session summary block

export type PromptPart = {
  role: PromptPartRole;
  content: string;
};

/**
 * Enforce the token budget over an array of prompt parts.
 *
 * Trim order (least important first):
 *   1. generated_doc blocks (completely removed then summarized)
 *   2. old user_history + assistant messages (oldest first)
 *   3. rag_chunk blocks (trim text, then remove)
 *   4. system prompt (truncate middle)
 *   5. user_current (truncate, absolute last resort)
 *
 * Invariants:
 *   - system part always preserved (may be partially truncated)
 *   - user_current always preserved (may be partially truncated)
 *   - session_summary preserved
 */
export function enforceTokenBudget(
  parts: PromptPart[],
  budget: TokenBudget
): { parts: PromptPart[]; estimatedTokens: number } {
  const maxChars = budget.maxInputTokens * 4;

  const calcTotal = (ps: PromptPart[]) => ps.reduce((s, p) => s + p.content.length, 0);

  let working = parts.map(p => ({ ...p }));

  if (calcTotal(working) <= maxChars) {
    return { parts: working, estimatedTokens: estimateTokens(working.map(p => p.content).join('')) };
  }

  // Step 1: Replace generated_doc blocks with compact placeholders
  working = working.map(p => {
    if (p.role === 'generated_doc' && p.content.length > 200) {
      return { ...p, content: '[Generated document — content removed from context to save tokens]' };
    }
    return p;
  });

  if (calcTotal(working) <= maxChars) {
    return { parts: working, estimatedTokens: estimateTokens(working.map(p => p.content).join('')) };
  }

  // Step 2: Trim old messages (history), oldest first
  const historyIndices = working
    .map((p, i) => ({ i, role: p.role }))
    .filter(x => x.role === 'user_history' || x.role === 'assistant')
    .map(x => x.i);

  for (const idx of historyIndices) {
    if (calcTotal(working) <= maxChars) break;
    working[idx] = { ...working[idx], content: '' };
  }

  if (calcTotal(working) <= maxChars) {
    return { parts: working, estimatedTokens: estimateTokens(working.map(p => p.content).join('')) };
  }

  // Step 3: Trim RAG chunks
  const ragIndices = working
    .map((p, i) => ({ i, role: p.role }))
    .filter(x => x.role === 'rag_chunk')
    .map(x => x.i);

  for (const idx of ragIndices) {
    if (calcTotal(working) <= maxChars) break;
    const chunkMaxChars = Math.min(budget.maxChunkChars, 400); // Emergency trim
    if (working[idx].content.length > chunkMaxChars) {
      working[idx] = { ...working[idx], content: working[idx].content.slice(0, chunkMaxChars) + '...' };
    } else {
      working[idx] = { ...working[idx], content: '' };
    }
  }

  if (calcTotal(working) <= maxChars) {
    return { parts: working, estimatedTokens: estimateTokens(working.map(p => p.content).join('')) };
  }

  // Step 4: Truncate system prompt (preserve first 800 chars)
  const sysIdx = working.findIndex(p => p.role === 'system');
  if (sysIdx >= 0 && working[sysIdx].content.length > 800) {
    const systemBudget = Math.max(800, Math.floor(maxChars * 0.35));
    working[sysIdx] = { ...working[sysIdx], content: truncateMiddle(working[sysIdx].content, systemBudget) };
  }

  if (calcTotal(working) <= maxChars) {
    return { parts: working, estimatedTokens: estimateTokens(working.map(p => p.content).join('')) };
  }

  // Step 5: Truncate current user message (absolute last resort)
  const curIdx = working.findIndex(p => p.role === 'user_current');
  if (curIdx >= 0) {
    const usedByOthers = calcTotal(working) - working[curIdx].content.length;
    const remaining = Math.max(800, maxChars - usedByOthers);
    working[curIdx] = { ...working[curIdx], content: truncateMiddle(working[curIdx].content, remaining) };
  }

  const finalTokens = estimateTokens(working.map(p => p.content).join(''));
  logger.warn('[TokenBudget] Enforced budget — prompt was oversized', {
    budget: budget.maxInputTokens,
    finalTokens,
  });

  return { parts: working, estimatedTokens: finalTokens };
}

function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 80) return value.slice(0, maxChars);
  const head = Math.floor(maxChars * 0.65);
  const tail = Math.max(20, maxChars - head - 48);
  return `${value.slice(0, head)}\n\n[...trimmed for token budget...]\n\n${value.slice(-tail)}`;
}

// ─── BACKWARDS-COMPATIBLE API (used by router.ts) ─────────────────────────────

const DEFAULT_MAX_PROMPT_CHARS = 24000;

export function estimateTokensFromText(...parts: Array<string | null | undefined>): number {
  const chars = parts.reduce((sum, part) => sum + (part?.length ?? 0), 0);
  return Math.max(1, Math.ceil(chars / 4));
}

export function getMaxPromptChars(): number {
  const configured = Number(process.env.MAX_PROMPT_CHARS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_PROMPT_CHARS;
}

export function isPromptTooLarge(value: string, maxChars = getMaxPromptChars()): boolean {
  return value.length > maxChars;
}

function totalMessageChars(messages: LLMMessage[]): number {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
}

/**
 * Budget-aware LLM message trimmer (backwards-compatible wrapper for router.ts).
 * Uses the task-specific budget when available, falls back to MAX_PROMPT_CHARS.
 */
export function budgetLLMMessages(input: {
  route: string;
  userId?: string;
  messages: LLMMessage[];
  maxPromptChars?: number;
  task?: AiTask;
}): { messages: LLMMessage[]; trimmed: boolean; originalTokens: number; finalTokens: number; fieldsTrimmed: string[] } {
  // Derive char limit from task budget if available
  let maxPromptChars = input.maxPromptChars ?? getMaxPromptChars();
  if (input.task) {
    const budget = getTokenBudget(input.task);
    maxPromptChars = Math.min(maxPromptChars, budget.maxInputTokens * 4);
  }

  const originalChars = totalMessageChars(input.messages);
  const originalTokens = estimateTokensFromText(...input.messages.map(m => m.content));
  const fieldsTrimmed: string[] = [];

  if (input.userId && isUnlimitedUser(input.userId)) {
    return { messages: input.messages, trimmed: false, originalTokens, finalTokens: originalTokens, fieldsTrimmed };
  }

  if (originalChars <= maxPromptChars) {
    return { messages: input.messages, trimmed: false, originalTokens, finalTokens: originalTokens, fieldsTrimmed };
  }

  const messages = input.messages.map(m => ({ ...m }));
  const lastUserIndex = [...messages].reverse().findIndex(m => m.role === 'user');
  const protectedCurrentUserIndex = lastUserIndex >= 0 ? messages.length - 1 - lastUserIndex : messages.length - 1;

  for (let i = 0; i < messages.length && totalMessageChars(messages) > maxPromptChars; i++) {
    if (i === 0 || i === protectedCurrentUserIndex) continue;
    if (messages[i].content.length === 0) continue;
    messages[i].content = '';
    fieldsTrimmed.push(`message:${i}`);
  }

  if (totalMessageChars(messages) > maxPromptChars) {
    const systemBudget = Math.max(1200, Math.floor(maxPromptChars * 0.45));
    if (messages[0]?.content.length > systemBudget) {
      messages[0].content = truncateMiddle(messages[0].content, systemBudget);
      fieldsTrimmed.push('system_prompt');
    }
  }

  if (totalMessageChars(messages) > maxPromptChars && messages[protectedCurrentUserIndex]) {
    const usedByOthers = totalMessageChars(messages) - messages[protectedCurrentUserIndex].content.length;
    const currentBudget = Math.max(1200, maxPromptChars - usedByOthers);
    messages[protectedCurrentUserIndex].content = truncateMiddle(messages[protectedCurrentUserIndex].content, currentBudget);
    fieldsTrimmed.push('current_user_message');
  }

  const finalTokens = estimateTokensFromText(...messages.map(m => m.content));
  logger.warn('[TokenBudget] Trimmed LLM input before provider call', {
    route: input.route,
    userId: input.userId,
    originalEstimatedTokens: originalTokens,
    finalEstimatedTokens: finalTokens,
    fieldsTrimmed,
  });

  return { messages, trimmed: true, originalTokens, finalTokens, fieldsTrimmed };
}
