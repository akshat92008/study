// lib/ai/rule-first-responder.ts
// Handles simple user intents deterministically without calling an AI model.
// This saves massive amounts of tokens for common queries.

import { isRuleFirstEnabled } from './cost-mode';
import { getCachedAiResponse, normalizePromptForCache, buildAiCacheKey } from './response-cache';
import { detectTaskComplexity } from './task-complexity';
import { logger } from '@/lib/utils/logger';

export interface RuleFirstResult {
  handled: boolean;
  response?: string;
  tokenSavedEstimate?: number;
  shouldQueue?: boolean; // For offloading to background worker
}

// ─── REGEX TRIGGERS ──────────────────────────────────────────────────────────

const WEAK_TOPICS_RE = /\b(weak(est)? (chapters?|topics?|subjects?|areas?)|what am i bad at|what should i focus on)\b/i;
const DAILY_STATS_RE = /\b(how many questions (today|did i do)|today'?s stats|my progress today)\b/i;
const REVISE_NOW_RE = /\b(what should i revise( now)?|overdue cards|pending revision)\b/i;
const LARGE_MCQ_RE = /\b([2-9]\d|1\d{2,})\s+(mcq|question|flashcard)s?\b/i;
const DEFINITION_RE = /^(what is|define) ([a-z0-9 ]{2,30})\??$/i;

// ─── HANDLERS ────────────────────────────────────────────────────────────────

function handleWeakTopics(mindContext: any): string | null {
  const weak = mindContext?.weakConcepts || [];
  if (!weak || weak.length === 0) {
    return "You don't have any weak topics flagged right now. Keep practicing!";
  }

  const list = weak.slice(0, 5).map((w: any) => `- **${w.name}** (${w.subject || 'Mixed'})`).join('\n');
  return `Based on your recent performance, here are your weakest topics right now:\n\n${list}\n\nWould you like me to generate some practice questions for one of these?`;
}

function handleDailyStats(mindContext: any): string | null {
  // If we had actual daily stats in mindContext, we'd use them.
  // Assuming they aren't currently plumbed in fully, we fall back.
  if (mindContext?.masteryStats) {
    const { masteredCount, totalConcepts, masteryPercent } = mindContext.masteryStats;
    return `You've mastered **${masteredCount} out of ${totalConcepts}** core concepts (${masteryPercent}% overall mastery). Keep going!`;
  }
  return null;
}

function handleReviseNow(mindContext: any): string | null {
  const count = mindContext?.overdueCardsCount || 0;
  if (count === 0) {
    return "You have no overdue flashcards to revise right now. Great job keeping up!";
  }

  const top = mindContext?.topOverdueCards || [];
  let topicList = '';
  if (top.length > 0) {
    const topics = Array.from(new Set(top.map((c: any) => c.topic || 'General'))).slice(0, 3);
    topicList = `\nThey mostly cover: ${topics.join(', ')}.`;
  }

  return `You have **${count} overdue flashcards** waiting for you.${topicList}\n\nWould you like to do a quick 10-card review session now?`;
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────

/**
 * Attempt to handle the user's chat message deterministically.
 */
export async function tryRuleFirstResponse(
  userId: string,
  message: string,
  mindContext: any
): Promise<RuleFirstResult> {
  if (!isRuleFirstEnabled() || !message || message.trim().length === 0) {
    return { handled: false };
  }

  const trimmed = message.trim();

  // 1. Weak topics
  if (WEAK_TOPICS_RE.test(trimmed)) {
    const response = handleWeakTopics(mindContext);
    if (response) {
      logger.info('[RuleFirst] Handled weak topics query', { userId });
      return { handled: true, response, tokenSavedEstimate: 800 };
    }
  }

  // 2. Daily Stats
  if (DAILY_STATS_RE.test(trimmed)) {
    const response = handleDailyStats(mindContext);
    if (response) {
      logger.info('[RuleFirst] Handled daily stats query', { userId });
      return { handled: true, response, tokenSavedEstimate: 800 };
    }
  }

  // 3. Revise Now
  if (REVISE_NOW_RE.test(trimmed)) {
    const response = handleReviseNow(mindContext);
    if (response) {
      logger.info('[RuleFirst] Handled revise now query', { userId });
      return { handled: true, response, tokenSavedEstimate: 800 };
    }
  }

  // 4. Large MCQ/Flashcard Generation offload
  // If they ask for 50 questions, we don't want to tie up the chat route.
  // We can acknowledge and signal the route to queue it.
  if (LARGE_MCQ_RE.test(trimmed)) {
    // The actual queuing logic will be handled by the route or ChatPlannerService,
    // but we can signal it here.
    logger.info('[RuleFirst] Detected large generation request', { userId });
    return {
      handled: true,
      shouldQueue: true,
      response: "That's a large request! I'm queuing it up as a background job. You can continue studying, and the document will appear in your Study Materials when it's ready.",
      tokenSavedEstimate: 3000
    };
  }

  // 5. Short definitions (check semantic cache directly)
  const isDef = DEFINITION_RE.test(trimmed);
  const complexity = detectTaskComplexity(trimmed);

  if (isDef || complexity === 'simple') {
    const norm = normalizePromptForCache(trimmed);
    const cacheKey = buildAiCacheKey('chat', norm);
    const cached = await getCachedAiResponse(cacheKey);

    if (cached?.responseText) {
      logger.info('[RuleFirst] Handled via Semantic Cache hit', { userId, cacheKey });
      return {
        handled: true,
        response: cached.responseText,
        tokenSavedEstimate: cached.tokenEstimate > 0 ? cached.tokenEstimate : 800
      };
    }
  }

  return { handled: false };
}
