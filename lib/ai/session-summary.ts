// lib/ai/session-summary.ts
// Maintains a rolling summary of chat sessions to prevent context loss
// when chat history is aggressively trimmed by the chat-history-sanitizer.

import { createAdminClient } from '@/lib/supabase/admin';
import type { ChatMessageForPrompt } from './chat-history-sanitizer';
import { logger } from '@/lib/utils/logger';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  summary: string;
  keyFacts: string[];
}

// ─── CORE ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the existing session summary, if any.
 */
export async function getSessionSummary(
  userId: string,
  sessionId: string
): Promise<SessionSummary | null> {
  try {
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from('chat_session_summaries')
      .select('summary, key_facts')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      logger.warn('[SessionSummary] Read error', { error: error.message, sessionId });
      return null;
    }

    if (!data) return null;

    return {
      summary: data.summary,
      keyFacts: (data.key_facts as string[]) || [],
    };
  } catch (err) {
    logger.warn('[SessionSummary] Read exception', { error: String(err), sessionId });
    return null;
  }
}

/**
 * Deterministically extract key facts and topics from the recent message batch.
 * This avoids calling an LLM entirely.
 */
function extractDeterministicSummary(messages: ChatMessageForPrompt[]): SessionSummary {
  const facts = new Set<string>();
  let lastTopic = '';

  for (const msg of messages) {
    if (!msg.metadata) continue;

    // Extract topics from intent classifier
    if (msg.metadata.intent?.topic) {
      lastTopic = msg.metadata.intent.topic;
      facts.add(`Studying topic: ${lastTopic}`);
    }
    if (msg.metadata.intent?.subject) {
      facts.add(`Subject: ${msg.metadata.intent.subject}`);
    }

    // Extract generated document records
    if (msg.metadata.generatedDocument || msg.metadata.kind) {
      const kind = msg.metadata.generatedDocument?.kind || msg.metadata.kind || 'document';
      const count = msg.metadata.generatedDocument?.count || msg.metadata.count || '';
      facts.add(`Generated ${count} ${kind}s`);
    }

    // Extract RAG usage
    if (msg.metadata.ragChunks?.length > 0) {
      facts.add(`Consulted uploaded material`);
    }
  }

  const factArray = Array.from(facts).slice(-5); // Keep last 5 facts

  const summary = lastTopic
    ? `Session focused on ${lastTopic}.`
    : `General study session.`;

  return {
    summary,
    keyFacts: factArray,
  };
}

/**
 * Update the session summary in the background.
 * Should be called asynchronously (fire-and-forget).
 *
 * It uses a deterministic extraction approach first to avoid LLM costs.
 */
export async function maybeUpdateSessionSummary(
  userId: string,
  sessionId: string,
  messages: ChatMessageForPrompt[]
): Promise<void> {
  // Only update if we have enough messages to warrant it (e.g., > 4)
  if (messages.length < 4) return;

  try {
    const newSummaryData = extractDeterministicSummary(messages);

    // Skip update if nothing meaningful was found
    if (newSummaryData.keyFacts.length === 0 && newSummaryData.summary === 'General study session.') {
      return;
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
      .from('chat_session_summaries')
      .upsert(
        {
          user_id: userId,
          session_id: sessionId,
          summary: newSummaryData.summary,
          key_facts: newSummaryData.keyFacts,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' }
      );

    if (error) {
      logger.warn('[SessionSummary] Write error', { error: error.message, sessionId });
    } else {
      logger.info('[SessionSummary] Updated', { sessionId, facts: newSummaryData.keyFacts.length });
    }
  } catch (err) {
    logger.warn('[SessionSummary] Write exception', { error: String(err), sessionId });
  }
}
