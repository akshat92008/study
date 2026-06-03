// lib/ai/chat-history-sanitizer.ts
// Strips token-expensive content from chat history before it is sent to a model.
//
// Key problem this solves:
//   A 90-question mock test (~25,000 chars of JSON) should NOT be re-sent in
//   every future chat turn. It should appear as a short placeholder like:
//   "[Generated document: mcq, 90 items, 2026-06-03]"
//
// This sanitizer is applied at prompt-construction time, AFTER loading messages
// from the DB but BEFORE calling any AI provider.

import { getAiCostMode } from './cost-mode';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type ChatMessageForPrompt = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
};

export type SanitizeOptions = {
  /** Max number of history messages to include (not counting the current user message) */
  maxMessages: number;
  /** Max chars an assistant message may be in aggressive mode */
  maxAssistantChars?: number;
  compressionMode?: 'none' | 'light' | 'aggressive' | 'summary_only';
  /** The current user message to always preserve (never trimmed) */
  currentUserMessage?: string;
};

// ─── REGEX PATTERNS ───────────────────────────────────────────────────────────

/** Matches long base64 payloads */
const BASE64_RE = /[A-Za-z0-9+/]{200,}={0,2}/g;

/** Matches large JSON arrays that look like generated documents */
const LARGE_JSON_DOC_RE = /"(questions|flashcards|formulae|sections|items)"\s*:\s*\[/;

/** Matches markdown tables */
const MARKDOWN_TABLE_RE = /^\|.+\|$/m;

/** Matches OCR dump markers */
const OCR_DUMP_RE = /\[OCR(?:_RAW)?(?:_DUMP)?\]/gi;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function stripBase64(content: string): string {
  return content.replace(BASE64_RE, '[base64-removed]');
}

function stripMarkdownTables(content: string): string {
  if (!MARKDOWN_TABLE_RE.test(content)) return content;
  const lines = content.split('\n');
  const cleaned = lines.filter(line => !line.trim().startsWith('|'));
  return cleaned.join('\n').trim();
}

function isLargeGeneratedJsonBlock(content: string): boolean {
  return LARGE_JSON_DOC_RE.test(content) && content.length > 500;
}

function summarizeGeneratedDocContent(content: string): string {
  // Try to extract kind/count from JSON
  try {
    const parsed = JSON.parse(content);
    const kind = parsed.kind ?? parsed.type ?? parsed.category ?? 'document';
    const items =
      parsed.questions?.length ??
      parsed.flashcards?.length ??
      parsed.formulae?.length ??
      parsed.items?.length ??
      parsed.sections?.length ??
      0;
    const title = parsed.title ?? parsed.name ?? '';
    const createdAt = parsed.createdAt ?? parsed.created_at ?? '';
    const titlePart = title ? `, title: "${title}"` : '';
    const datePart = createdAt ? `, created: ${String(createdAt).slice(0, 10)}` : '';
    return `[Generated document: ${kind}${titlePart}, ${items} items${datePart}]`;
  } catch {
    // Not valid JSON — produce a generic summary
    const lengthK = Math.round(content.length / 1000);
    return `[Generated document: ~${lengthK}k chars — removed from context]`;
  }
}

function buildGeneratedDocPlaceholder(metadata: Record<string, any>): string {
  const kind = metadata.generatedDocument?.kind ?? metadata.kind ?? 'document';
  const title = metadata.generatedDocument?.title ?? metadata.title ?? '';
  const count =
    metadata.generatedDocument?.count ??
    metadata.generatedDocument?.questionCount ??
    metadata.count ??
    '';
  const createdAt = metadata.generatedDocument?.createdAt ?? metadata.createdAt ?? '';

  const parts = [`Generated document: ${kind}`];
  if (title) parts.push(`title: "${title}"`);
  if (count) parts.push(`${count} items`);
  if (createdAt) parts.push(`created: ${String(createdAt).slice(0, 10)}`);

  return `[${parts.join(', ')}]`;
}

// ─── MAIN SANITIZER ───────────────────────────────────────────────────────────

/**
 * Sanitize chat history messages before they are used in an AI prompt.
 *
 * Rules applied (in order):
 *  1. Slice to last `maxMessages` — preserving current user message always
 *  2. Replace generatedDocument metadata messages with compact placeholder
 *  3. Replace large JSON doc blocks (questions/flashcards/etc) with summary
 *  4. Truncate long assistant messages in aggressive mode
 *  5. Strip base64 blobs
 *  6. Strip OCR dump markers
 *  7. Strip markdown tables from old assistant messages > 1000 chars
 *
 * @param messages  Full message history from DB
 * @param options   Budget-driven sanitize options
 * @returns Sanitized messages safe to include in a prompt
 */
export function sanitizeMessagesForPrompt(
  messages: ChatMessageForPrompt[],
  options: SanitizeOptions
): ChatMessageForPrompt[] {
  if (!messages || messages.length === 0) return [];

  const mode = options.compressionMode ?? getAiCostMode();
  const maxAssistantChars = options.maxAssistantChars ?? (mode === 'ultra_cheap' ? 500 : 1200);
  const { maxMessages, currentUserMessage } = options;

  // Split current user message from history
  // The current user message is the last message in the array if role is 'user'
  let history = [...messages];
  let currentMsg: ChatMessageForPrompt | null = null;

  if (history.length > 0 && history[history.length - 1].role === 'user') {
    const lastMsg = history[history.length - 1];
    // If it matches the current user message, protect it
    if (
      !currentUserMessage ||
      lastMsg.content === currentUserMessage ||
      currentUserMessage.startsWith(lastMsg.content.slice(0, 50))
    ) {
      currentMsg = lastMsg;
      history = history.slice(0, -1);
    }
  }

  // Rule 1: Slice to last N messages
  if (history.length > maxMessages) {
    history = history.slice(-maxMessages);
  }

  // Apply sanitization rules to history messages
  const sanitized = history.map((msg, idx): ChatMessageForPrompt => {
    let content = msg.content;
    const metadata = msg.metadata ?? {};
    const isOld = idx < history.length - 1; // Not the most recent history message

    // Rule 2: Replace messages with generatedDocument metadata
    if (metadata.generatedDocument || metadata.kind) {
      return {
        ...msg,
        content: buildGeneratedDocPlaceholder(metadata),
      };
    }

    // Rule 3: Replace large JSON doc blocks
    if (isLargeGeneratedJsonBlock(content)) {
      // Try to extract from JSON first
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const jsonPart = content.slice(firstBrace, lastBrace + 1);
        return { ...msg, content: summarizeGeneratedDocContent(jsonPart) };
      }
      return { ...msg, content: '[Generated document — removed from context]' };
    }

    // Rule 5: Strip base64
    content = stripBase64(content);

    // Rule 6: Strip OCR dumps
    content = content.replace(OCR_DUMP_RE, '[ocr-removed]');

    // Rule 4: Truncate long assistant messages in aggressive/ultra_cheap mode
    if (
      msg.role === 'assistant' &&
      content.length > maxAssistantChars &&
      (mode === 'aggressive' || mode === 'ultra_cheap' || mode === 'summary_only')
    ) {
      content = content.slice(0, maxAssistantChars) + '...[compact mode]';
    }

    // Rule 7: Strip markdown tables from old assistant messages > 1000 chars
    if (msg.role === 'assistant' && isOld && content.length > 1000) {
      content = stripMarkdownTables(content);
    }

    return { ...msg, content };
  });

  // Re-attach current user message at the end
  if (currentMsg) {
    sanitized.push(currentMsg);
  }

  return sanitized.filter(m => m.content.trim().length > 0);
}

/**
 * Convenience wrapper: sanitize and apply budget from token budget settings.
 */
export function sanitizeHistoryForPrompt(
  messages: ChatMessageForPrompt[],
  maxMessages: number,
  currentUserMessage?: string
): ChatMessageForPrompt[] {
  const mode = getAiCostMode();
  return sanitizeMessagesForPrompt(messages, {
    maxMessages,
    compressionMode: mode === 'ultra_cheap' ? 'aggressive' : mode === 'cheap' ? 'light' : 'none',
    maxAssistantChars: mode === 'ultra_cheap' ? 500 : mode === 'cheap' ? 800 : 1200,
    currentUserMessage,
  });
}
