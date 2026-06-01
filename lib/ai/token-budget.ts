import { logger } from '@/lib/utils/logger';

export type LLMMessage = { role: string; content: string };

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

function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 80) return value.slice(0, maxChars);

  const head = Math.floor(maxChars * 0.65);
  const tail = Math.max(20, maxChars - head - 48);
  return `${value.slice(0, head)}\n\n[...trimmed for token budget...]\n\n${value.slice(-tail)}`;
}

export function budgetLLMMessages(input: {
  route: string;
  userId?: string;
  messages: LLMMessage[];
  maxPromptChars?: number;
}): { messages: LLMMessage[]; trimmed: boolean; originalTokens: number; finalTokens: number; fieldsTrimmed: string[] } {
  const maxPromptChars = input.maxPromptChars ?? getMaxPromptChars();
  const originalChars = totalMessageChars(input.messages);
  const originalTokens = estimateTokensFromText(...input.messages.map((message) => message.content));
  const fieldsTrimmed: string[] = [];

  if (originalChars <= maxPromptChars) {
    return {
      messages: input.messages,
      trimmed: false,
      originalTokens,
      finalTokens: originalTokens,
      fieldsTrimmed,
    };
  }

  const messages = input.messages.map((message) => ({ ...message }));
  const lastUserIndex = [...messages].reverse().findIndex((message) => message.role === 'user');
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

  const finalTokens = estimateTokensFromText(...messages.map((message) => message.content));
  logger.warn('[TokenBudget] Trimmed LLM input before provider call', {
    route: input.route,
    userId: input.userId,
    originalEstimatedTokens: originalTokens,
    finalEstimatedTokens: finalTokens,
    fieldsTrimmed,
  });

  return {
    messages,
    trimmed: true,
    originalTokens,
    finalTokens,
    fieldsTrimmed,
  };
}
